import { Injectable, Logger } from '@nestjs/common';
import { AgentRole } from '@bhuvi/shared';
import { OllamaProvider } from '../../ai/ollama.provider';
import { BaseAgent, AgentContext, AgentExecutionResult } from './base-agent.interface';

@Injectable()
export class ResearchAgent implements BaseAgent {
  readonly role: AgentRole = 'RESEARCH';
  readonly description =
    'Analyzes provided information, identifies knowledge gaps, and produces structured research summaries';
  private readonly logger = new Logger(ResearchAgent.name);

  constructor(private readonly ollamaProvider: OllamaProvider) {}

  async execute(context: AgentContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `ResearchAgent executing step [${context.stepKey}] for plan [${context.planId}]`,
    );

    const systemPrompt = `You are the BHUVI Research Agent.
Your role:
- Deeply analyze the information provided in the user request: "${context.userPrompt}".
- Execute the specific research step: "${context.stepTitle}" - "${context.stepDescription}".
- Identify clear facts, potential assumptions, and any missing information that needs clarification.
- CRITICAL BOUNDARY: You operate strictly on the text provided. Do NOT claim access to the live internet, email inboxes, files, or external third-party services.
- Provide a clear, well-structured research summary in Markdown.`;

    const previousContext = context.previousOutputs?.length
      ? `\nPrior findings from earlier steps:\n` +
        context.previousOutputs.map((p) => `- ${p.title} (${p.agent}): ${p.summary}`).join('\n')
      : '';

    try {
      const response = await this.ollamaProvider.chat([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Please analyze and research the following step: "${context.stepTitle}".${previousContext}`,
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
      this.logger.error(`ResearchAgent execution failed on step [${context.stepKey}]: ${errorMsg}`);
      return {
        success: false,
        agent: this.role,
        summary: 'Research step execution failed',
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };
    }
  }
}
