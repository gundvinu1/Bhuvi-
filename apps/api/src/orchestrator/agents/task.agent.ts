import { Injectable, Logger, Optional } from '@nestjs/common';
import { AgentRole } from '@bhuvi/shared';
import { OllamaProvider } from '../../ai/ollama.provider';
import { MessageIntelligenceService } from '../../messages/services/message-intelligence.service';
import { BaseAgent, AgentContext, AgentExecutionResult } from './base-agent.interface';

@Injectable()
export class TaskAgent implements BaseAgent {
  readonly role: AgentRole = 'TASK';
  readonly description =
    'Identifies actionable tasks, constructs prioritized checklists, and sets execution milestones';
  private readonly logger = new Logger(TaskAgent.name);

  constructor(
    private readonly ollamaProvider: OllamaProvider,
    @Optional() private readonly messageIntelligenceService?: MessageIntelligenceService,
  ) {}

  async execute(context: AgentContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    this.logger.log(`TaskAgent executing step [${context.stepKey}] for plan [${context.planId}]`);

    const systemPrompt = `You are the BHUVI Task Agent.
Your role:
- Extract clear, discrete, actionable tasks and checklists from the request: "${context.userPrompt}".
- Execute the task step: "${context.stepTitle}" - "${context.stepDescription}".
- Assign logical priorities (HIGH, MEDIUM, LOW) and estimated timelines when context permits.
- CRITICAL BOUNDARY: You do NOT create real external calendar events or alter system files. You produce actionable checklists for user tracking.
- Output a clean Markdown checklist using checkbox format: - [ ] [PRIORITY] Task description.`;

    const previousContext = context.previousOutputs?.length
      ? `\nPrior findings from earlier steps:\n` +
        context.previousOutputs.map((p) => `- ${p.title} (${p.agent}): ${p.summary}`).join('\n')
      : '';

    const isMessageAnalysis =
      /\b(analyze\s+(this\s+)?(message|email|text)|extract\s+tasks?\s+from\s+(this\s+)?(message|email))\b/i.test(
        context.userPrompt,
      );

    if (isMessageAnalysis && this.messageIntelligenceService) {
      try {
        const analysis = await this.messageIntelligenceService.analyzeContent(
          context.userPrompt,
          'User Request',
          context.stepTitle,
        );

        const checklistLines = analysis.actionItems.map(
          (item) =>
            `- [ ] [${item.priority}] ${item.title}${item.description ? `: ${item.description}` : ''}`,
        );

        const summary = `Message analyzed: ${analysis.summary} (${analysis.actionItems.length} action item(s) extracted)`;
        const checklist =
          checklistLines.length > 0
            ? checklistLines.join('\n')
            : `- [ ] [${analysis.priority}] Review message and determine follow-up actions`;

        return {
          success: true,
          agent: this.role,
          summary,
          details: {
            checklist,
            category: analysis.category,
            priority: analysis.priority,
            urgency: analysis.urgency,
            actionItems: analysis.actionItems,
            stepKey: context.stepKey,
            executionTimeMs: Date.now() - startTime,
          },
          durationMs: Date.now() - startTime,
        };
      } catch (intelligenceErr: unknown) {
        this.logger.warn(
          `MessageIntelligenceService failed in TaskAgent, falling back to default LLM: ${(intelligenceErr as Error).message}`,
        );
      }
    }

    try {
      const response = await this.ollamaProvider.chat([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Please generate the action checklist for step: "${context.stepTitle}".${previousContext}`,
        },
      ]);

      return {
        success: true,
        agent: this.role,
        summary: response.content.slice(0, 300).trim(),
        details: {
          checklist: response.content,
          stepKey: context.stepKey,
          executionTimeMs: Date.now() - startTime,
        },
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`TaskAgent execution failed on step [${context.stepKey}]: ${errorMsg}`);
      return {
        success: false,
        agent: this.role,
        summary: 'Task step execution failed',
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };
    }
  }
}
