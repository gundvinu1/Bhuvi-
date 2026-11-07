import { Injectable, Logger } from '@nestjs/common';
import { AgentRole } from '@bhuvi/shared';
import { OllamaProvider } from '../../ai/ollama.provider';
import { BaseAgent, AgentContext, AgentExecutionResult } from './base-agent.interface';

@Injectable()
export class PlanningAgent implements BaseAgent {
  readonly role: AgentRole = 'PLANNING';
  readonly description =
    'Formulates structured project workflows, milestones, and step dependencies';
  private readonly logger = new Logger(PlanningAgent.name);

  constructor(private readonly ollamaProvider: OllamaProvider) {}

  async execute(context: AgentContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `PlanningAgent executing step [${context.stepKey}] for plan [${context.planId}]`,
    );

    const systemPrompt = `You are the BHUVI Planning Agent.
Your role:
- Understand the assigned task: "${context.stepTitle}".
- Detailed description: "${context.stepDescription}".
- Overall user goal: "${context.userPrompt}".
- Synthesize actionable objectives, milestone requirements, and logical dependencies.
- Provide a clear, professional, structured breakdown in Markdown with bullet points.
- Never claim to have performed external actions or accessed remote accounts.`;

    const previousContext = context.previousOutputs?.length
      ? `\nPrevious step insights:\n` +
        context.previousOutputs.map((p) => `- ${p.title} (${p.agent}): ${p.summary}`).join('\n')
      : '';

    try {
      const response = await this.ollamaProvider.chat([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Please execute the planning step: "${context.stepTitle}".${previousContext}`,
        },
      ]);

      return {
        success: true,
        agent: this.role,
        summary: response.content.slice(0, 300).trim(),
        details: {
          content: response.content,
          stepKey: context.stepKey,
          executionTimeMs: Date.now() - startTime,
        },
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`PlanningAgent execution failed on step [${context.stepKey}]: ${errorMsg}`);
      return {
        success: false,
        agent: this.role,
        summary: 'Planning step execution failed',
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };
    }
  }
}
