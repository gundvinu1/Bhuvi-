import { Injectable, Logger } from '@nestjs/common';
import { AgentRole } from '@bhuvi/shared';
import { OllamaProvider } from '../../ai/ollama.provider';
import { BaseAgent, AgentContext, AgentExecutionResult } from './base-agent.interface';

@Injectable()
export class CommunicationAgent implements BaseAgent {
  readonly role: AgentRole = 'COMMUNICATION';
  readonly description =
    'Drafts messages, refines tone, and summarizes communications with human approval boundaries';
  private readonly logger = new Logger(CommunicationAgent.name);

  constructor(private readonly ollamaProvider: OllamaProvider) {}

  async execute(context: AgentContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `CommunicationAgent executing step [${context.stepKey}] for plan [${context.planId}]`,
    );

    const systemPrompt = `You are the BHUVI Communication Agent.
Your role:
- Draft clear, empathetic, and professional communications.
- Step to execute: "${context.stepTitle}" - "${context.stepDescription}".
- Overall user intent: "${context.userPrompt}".
- Produce high-quality message drafts, subject lines, or bullet-point summaries.
- CRITICAL BOUNDARY: You NEVER send real emails, WhatsApp messages, or social posts. You only draft proposals for human review.`;

    const previousContext = context.previousOutputs?.length
      ? `\nContext from earlier steps:\n` +
        context.previousOutputs.map((p) => `- ${p.title} (${p.agent}): ${p.summary}`).join('\n')
      : '';

    try {
      const response = await this.ollamaProvider.chat([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Please draft the communication for step: "${context.stepTitle}".${previousContext}`,
        },
      ]);

      const content = response.content.trim();
      const isDraftOrOutreach =
        context.stepTitle.toLowerCase().includes('email') ||
        context.stepTitle.toLowerCase().includes('message') ||
        context.stepTitle.toLowerCase().includes('send') ||
        context.stepTitle.toLowerCase().includes('draft');

      return {
        success: true,
        agent: this.role,
        summary: content.slice(0, 300).trim(),
        details: {
          draft: content,
          stepKey: context.stepKey,
          executionTimeMs: Date.now() - startTime,
        },
        requiresApproval: isDraftOrOutreach,
        proposal: isDraftOrOutreach
          ? {
              actionType: 'PROPOSAL_MESSAGE_DRAFT',
              description: `Draft prepared for "${context.stepTitle}". Requires human review prior to any external use.`,
              data: {
                stepKey: context.stepKey,
                title: context.stepTitle,
                content,
              },
            }
          : undefined,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `CommunicationAgent execution failed on step [${context.stepKey}]: ${errorMsg}`,
      );
      return {
        success: false,
        agent: this.role,
        summary: 'Communication step execution failed',
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };
    }
  }
}
