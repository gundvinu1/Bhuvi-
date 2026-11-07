import { Injectable, Logger } from '@nestjs/common';
import { OllamaProvider } from '../../ai/ollama.provider';
import {
  IntentCategory,
  AgentRole,
  IntentAnalysisResult,
  RawIntentModelOutput,
} from './intent.types';

const VALID_INTENTS: Record<IntentCategory, true> = {
  GENERAL_QUESTION: true,
  RESEARCH: true,
  PLANNING: true,
  COMMUNICATION: true,
  TASK_MANAGEMENT: true,
  MULTI_STEP: true,
  UNKNOWN: true,
};

const VALID_ROLES: Record<AgentRole, true> = {
  PLANNING: true,
  RESEARCH: true,
  COMMUNICATION: true,
  TASK: true,
};

export const INTENT_SYSTEM_PROMPT = `You are the BHUVI Intent Classifier and Task Categorizer.
Your goal is to analyze the user's message and categorize their intent into exactly one of these 7 categories:
1. GENERAL_QUESTION: Purely informational or factual inquiry, explanations, or greeting.
2. RESEARCH: Inquiries requiring synthesis or deep analysis of supplied content or factual points.
3. PLANNING: Structuring multi-stage projects, event preparation, workflows, or scheduling strategies.
4. COMMUNICATION: Drafting emails, formatting messages, adjusting tone, or summarizing discussions.
5. TASK_MANAGEMENT: Generating actionable checklists, prioritizing tasks, or setting action milestones.
6. MULTI_STEP: Complex requests that span multiple domains requiring coordinated multi-step agent execution.
7. UNKNOWN: Ambiguous, gibberish, or incomprehensible input.

You must choose which of the 4 logical agents should be involved:
- "PLANNING" (for structure, planning, step definition)
- "RESEARCH" (for factual analysis of provided content)
- "COMMUNICATION" (for drafting or reviewing messages)
- "TASK" (for actionable tasks and checklists)

You must respond with ONLY a valid, raw JSON object matching this exact schema:
{
  "intent": "PLANNING",
  "explanation": "A short, one-sentence rationale for this category",
  "confidence": 0.95,
  "selectedAgents": ["PLANNING", "TASK"],
  "clarificationNeeded": false,
  "clarificationPrompt": null
}

Do not wrap in backticks or markdown fences if possible. Return ONLY JSON.`;

@Injectable()
export class IntentAnalyzerService {
  private readonly logger = new Logger(IntentAnalyzerService.name);

  constructor(private readonly ollamaProvider: OllamaProvider) {}

  /**
   * Analyzes user message to determine intent, confidence, and target agent roles.
   * Guarantees a valid IntentAnalysisResult via strict JSON validation and deterministic fallbacks.
   */
  async analyze(message: string): Promise<IntentAnalysisResult> {
    const cleanMessage = message.trim();
    if (!cleanMessage) {
      return {
        intent: 'UNKNOWN',
        explanation: 'Empty or blank input provided',
        confidence: 1.0,
        selectedAgents: ['PLANNING'],
        clarificationNeeded: true,
        clarificationPrompt: 'Please provide a task or question for BHUVI to assist you with.',
      };
    }

    try {
      const response = await this.ollamaProvider.chat([
        {
          role: 'system',
          content: INTENT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: cleanMessage,
        },
      ]);

      const parsed = this.parseModelOutput(response.content);
      if (parsed) {
        return parsed;
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Ollama intent analysis failed or was unavailable: ${(err as Error).message}. Using rule-based fallback.`,
      );
    }

    // Deterministic rule-based fallback if Ollama is unavailable or returned unparseable output
    return this.ruleBasedFallback(cleanMessage);
  }

  /**
   * Safely extracts and validates JSON from model response string
   */
  private parseModelOutput(content: string): IntentAnalysisResult | null {
    try {
      // Extract JSON substring if wrapped in markdown code blocks or conversational text
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

      const raw = JSON.parse(jsonString) as RawIntentModelOutput;
      if (!raw || typeof raw !== 'object') {
        return null;
      }

      // Validate & normalize intent category
      const rawIntent = (raw.intent || '').toUpperCase().trim();
      const intent: IntentCategory =
        rawIntent in VALID_INTENTS ? (rawIntent as IntentCategory) : 'UNKNOWN';

      // Validate confidence score (clamp to 0.0 - 1.0)
      let confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.8;
      if (confidence < 0) confidence = 0.0;
      if (confidence > 1) confidence = 1.0;

      // Validate selected agents
      const selectedAgents: AgentRole[] = [];
      if (Array.isArray(raw.selectedAgents)) {
        for (const item of raw.selectedAgents) {
          const upper = String(item).toUpperCase().trim();
          if (upper in VALID_ROLES && !selectedAgents.includes(upper as AgentRole)) {
            selectedAgents.push(upper as AgentRole);
          }
        }
      }

      // Guarantee at least one valid agent is selected
      if (selectedAgents.length === 0) {
        selectedAgents.push(this.getDefaultAgentForIntent(intent));
      }

      return {
        intent,
        explanation: raw.explanation || 'Intent classified from request parameters',
        confidence,
        selectedAgents,
        clarificationNeeded: Boolean(raw.clarificationNeeded),
        clarificationPrompt: raw.clarificationPrompt || undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Maps an intent category to an appropriate default agent role
   */
  private getDefaultAgentForIntent(intent: IntentCategory): AgentRole {
    switch (intent) {
      case 'COMMUNICATION':
        return 'COMMUNICATION';
      case 'RESEARCH':
        return 'RESEARCH';
      case 'TASK_MANAGEMENT':
        return 'TASK';
      case 'PLANNING':
      case 'MULTI_STEP':
      case 'GENERAL_QUESTION':
      default:
        return 'PLANNING';
    }
  }

  /**
   * Deterministic keyword-based fallback when model inference fails or outputs malformed text
   */
  private ruleBasedFallback(message: string): IntentAnalysisResult {
    const lower = message.toLowerCase();

    if (
      lower.includes('email') ||
      lower.includes('message') ||
      lower.includes('draft') ||
      lower.includes('reply')
    ) {
      return {
        intent: 'COMMUNICATION',
        explanation: 'Identified communication keywords in user request',
        confidence: 0.75,
        selectedAgents: ['COMMUNICATION', 'PLANNING'],
        clarificationNeeded: false,
      };
    }

    if (
      lower.includes('plan') ||
      lower.includes('prepare') ||
      lower.includes('schedule') ||
      lower.includes('organize')
    ) {
      return {
        intent: 'PLANNING',
        explanation: 'Identified planning and organization keywords in user request',
        confidence: 0.8,
        selectedAgents: ['PLANNING', 'TASK'],
        clarificationNeeded: false,
      };
    }

    if (
      lower.includes('task') ||
      lower.includes('todo') ||
      lower.includes('priority') ||
      lower.includes('checklist')
    ) {
      return {
        intent: 'TASK_MANAGEMENT',
        explanation: 'Identified task management keywords in user request',
        confidence: 0.8,
        selectedAgents: ['TASK'],
        clarificationNeeded: false,
      };
    }

    if (
      lower.includes('research') ||
      lower.includes('analyze') ||
      lower.includes('investigate') ||
      lower.includes('summarize')
    ) {
      return {
        intent: 'RESEARCH',
        explanation: 'Identified research and analytical keywords in user request',
        confidence: 0.75,
        selectedAgents: ['RESEARCH'],
        clarificationNeeded: false,
      };
    }

    return {
      intent: 'GENERAL_QUESTION',
      explanation: 'General query fallback',
      confidence: 0.7,
      selectedAgents: ['PLANNING'],
      clarificationNeeded: false,
    };
  }
}
