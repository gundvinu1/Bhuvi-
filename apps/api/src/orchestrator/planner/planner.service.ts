import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AgentRole } from '@bhuvi/shared';
import { OllamaProvider } from '../../ai/ollama.provider';
import { IntentAnalysisResult } from '../intent/intent.types';
import { PlannedStepDefinition, GeneratedPlan, RawPlannerModelOutput } from './planner.types';

export const MAX_PLAN_STEPS = 10;

const VALID_ROLES: Record<AgentRole, true> = {
  PLANNING: true,
  RESEARCH: true,
  COMMUNICATION: true,
  TASK: true,
};

export const PLANNER_SYSTEM_PROMPT = `You are the BHUVI AI Planning Engine.
Your responsibility is to take a user request and construct a concrete, structured execution plan broken into discrete steps.
Each step must be assigned to exactly one of the 4 authorized logical agent roles:
- "PLANNING": for scoping, organizing, defining objectives or milestone outlines.
- "RESEARCH": for analyzing provided information or investigating context facts.
- "COMMUNICATION": for drafting emails, notices, or summaries (note: sensitive drafts require human approval).
- "TASK": for generating checklists, task action items, or setting priority levels.

Rules:
1. Break down the task into between 2 and 6 logical steps (maximum ${MAX_PLAN_STEPS} steps).
2. Assign each step a sequential stepKey ("step-1", "step-2", etc.).
3. Explicitly declare dependencies for each step as an array of prior stepKeys (e.g. "step-2" might depend on ["step-1"]).
4. NEVER create circular dependencies (e.g. step-1 cannot depend on step-2 if step-2 depends on step-1).
5. If a step involves drafting external communications or sensitive proposals, set "requiresApproval" to true.
6. Provide a concise, clear title for the entire plan.

You must respond with ONLY raw, valid JSON matching this schema:
{
  "title": "Meeting Preparation Plan",
  "steps": [
    {
      "stepKey": "step-1",
      "title": "Identify Meeting Goals & Agenda",
      "description": "Outline core discussion topics and objectives.",
      "assignedAgent": "PLANNING",
      "dependencies": [],
      "requiresApproval": false
    },
    {
      "stepKey": "step-2",
      "title": "Analyze Discussion Documents",
      "description": "Synthesize key data and talking points from background notes.",
      "assignedAgent": "RESEARCH",
      "dependencies": ["step-1"],
      "requiresApproval": false
    },
    {
      "stepKey": "step-3",
      "title": "Draft Agenda Briefing Email",
      "description": "Prepare agenda summary email for participants.",
      "assignedAgent": "COMMUNICATION",
      "dependencies": ["step-2"],
      "requiresApproval": true
    },
    {
      "stepKey": "step-4",
      "title": "Create Action Item Checklist",
      "description": "Formulate prioritized prep checklist.",
      "assignedAgent": "TASK",
      "dependencies": ["step-1"],
      "requiresApproval": false
    }
  ]
}

Do not wrap in backticks or markdown fences if possible. Return ONLY JSON.`;

@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name);

  constructor(private readonly ollamaProvider: OllamaProvider) {}

  /**
   * Generates a validated execution plan from user request and intent analysis.
   */
  async generatePlan(message: string, intentResult: IntentAnalysisResult): Promise<GeneratedPlan> {
    const cleanMessage = message.trim();
    this.logger.log(`Generating plan for request: "${cleanMessage.slice(0, 50)}..."`);

    try {
      const response = await this.ollamaProvider.chat([
        { role: 'system', content: PLANNER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `User Request: "${cleanMessage}"\nIdentified Intent: ${intentResult.intent}\nIntent Rationale: ${intentResult.explanation}`,
        },
      ]);

      const parsed = this.parsePlannerOutput(response.content, cleanMessage, intentResult);
      if (parsed) {
        this.validatePlanStructure(parsed.steps);
        return parsed;
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Ollama plan generation failed or output invalid: ${(err as Error).message}. Generating deterministic fallback plan.`,
      );
    }

    // Deterministic fallback plan if model call fails or returns invalid JSON
    return this.createFallbackPlan(cleanMessage, intentResult);
  }

  /**
   * Parses and normalizes raw model output
   */
  private parsePlannerOutput(
    content: string,
    userPrompt: string,
    intentResult: IntentAnalysisResult,
  ): GeneratedPlan | null {
    try {
      let jsonString = content.trim();
      const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonString = codeBlockMatch[1].trim();
      } else {
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        }
      }

      const raw = JSON.parse(jsonString) as RawPlannerModelOutput;
      if (!raw || !Array.isArray(raw.steps) || raw.steps.length === 0) {
        return null;
      }

      // Limit steps to MAX_PLAN_STEPS
      const rawSteps = raw.steps.slice(0, MAX_PLAN_STEPS);
      const steps: PlannedStepDefinition[] = [];

      for (let i = 0; i < rawSteps.length; i++) {
        const s = rawSteps[i];
        if (!s || !s.title) continue;

        const stepKey = s.stepKey || `step-${i + 1}`;
        const rawRole = (s.assignedAgent || 'PLANNING').toUpperCase().trim();
        const assignedAgent: AgentRole =
          rawRole in VALID_ROLES ? (rawRole as AgentRole) : 'PLANNING';

        // Filter dependencies to valid prior stepKeys
        const dependencies = Array.isArray(s.dependencies)
          ? s.dependencies.map(String).filter((dep) => dep !== stepKey)
          : [];

        const requiresApproval =
          Boolean(s.requiresApproval) ||
          assignedAgent === 'COMMUNICATION' ||
          s.title.toLowerCase().includes('email') ||
          s.title.toLowerCase().includes('message') ||
          s.title.toLowerCase().includes('send');

        steps.push({
          stepKey,
          stepIndex: i + 1,
          title: s.title.trim(),
          description: s.description || s.title.trim(),
          assignedAgent,
          dependencies,
          requiresApproval,
        });
      }

      if (steps.length === 0) return null;

      const title = raw.title?.trim() || `Plan: ${userPrompt.slice(0, 40)}`;

      return {
        title,
        intentCategory: intentResult.intent,
        explanation: intentResult.explanation,
        steps,
      };
    } catch {
      return null;
    }
  }

  /**
   * Deterministic validation: checks step counts, validates dependency references, and rejects circular dependencies.
   */
  validatePlanStructure(steps: PlannedStepDefinition[]): void {
    if (!steps || steps.length === 0) {
      throw new BadRequestException('Plan must contain at least one step');
    }

    if (steps.length > MAX_PLAN_STEPS) {
      throw new BadRequestException(`Plan step count cannot exceed maximum of ${MAX_PLAN_STEPS}`);
    }

    const stepKeys = new Set<string>();

    // 1. Validate unique step keys and authorized agent roles
    for (const step of steps) {
      if (!step.stepKey || !step.stepKey.trim()) {
        throw new BadRequestException('Each plan step must have a non-empty stepKey');
      }

      if (stepKeys.has(step.stepKey)) {
        throw new BadRequestException(
          `Duplicate stepKey "${step.stepKey}" found in plan. Step identifiers must be unique.`,
        );
      }
      stepKeys.add(step.stepKey);

      if (!VALID_ROLES[step.assignedAgent]) {
        throw new BadRequestException(
          `Step "${step.stepKey}" has invalid assignedAgent "${step.assignedAgent}". Must be one of PLANNING, RESEARCH, COMMUNICATION, TASK.`,
        );
      }
    }

    // 2. Validate that all referenced dependencies exist and are not self-referential
    for (const step of steps) {
      for (const dep of step.dependencies) {
        if (dep === step.stepKey) {
          throw new BadRequestException(
            `Step "${step.stepKey}" has a self-dependency, which is invalid.`,
          );
        }
        if (!stepKeys.has(dep)) {
          throw new BadRequestException(
            `Step "${step.stepKey}" references non-existent dependency "${dep}".`,
          );
        }
      }
    }

    // 3. Circular dependency check using Depth-First Search (cycle detection)
    const adjacency = new Map<string, string[]>();
    for (const step of steps) {
      adjacency.set(step.stepKey, step.dependencies);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      const neighbors = adjacency.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true; // Cycle detected
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const stepKey of stepKeys) {
      if (!visited.has(stepKey)) {
        if (hasCycle(stepKey)) {
          throw new BadRequestException(
            `Circular dependency detected in plan steps involving "${stepKey}". Invalid execution graph.`,
          );
        }
      }
    }
  }

  /**
   * Deterministic fallback plan creation based on identified intent
   */
  private createFallbackPlan(
    userPrompt: string,
    intentResult: IntentAnalysisResult,
  ): GeneratedPlan {
    const title = `Execution Plan: ${userPrompt.slice(0, 45)}`;

    const steps: PlannedStepDefinition[] = [
      {
        stepKey: 'step-1',
        stepIndex: 1,
        title: 'Analyze Request Scope & Requirements',
        description: 'Examine objectives and identify requirements for the task.',
        assignedAgent: 'PLANNING',
        dependencies: [],
        requiresApproval: false,
      },
      {
        stepKey: 'step-2',
        stepIndex: 2,
        title: 'Synthesize Relevant Information & Guidelines',
        description: 'Review contextual information and identify key constraints.',
        assignedAgent: 'RESEARCH',
        dependencies: ['step-1'],
        requiresApproval: false,
      },
      {
        stepKey: 'step-3',
        stepIndex: 3,
        title: 'Formulate Prioritized Action Items',
        description: 'Generate structured checklist and actionable milestones.',
        assignedAgent: 'TASK',
        dependencies: ['step-2'],
        requiresApproval: false,
      },
    ];

    if (intentResult.intent === 'COMMUNICATION') {
      steps.push({
        stepKey: 'step-4',
        stepIndex: 4,
        title: 'Draft Communication Content',
        description: 'Prepare communication draft for human review.',
        assignedAgent: 'COMMUNICATION',
        dependencies: ['step-3'],
        requiresApproval: true,
      });
    }

    return {
      title,
      intentCategory: intentResult.intent,
      explanation: intentResult.explanation,
      steps,
    };
  }
}
