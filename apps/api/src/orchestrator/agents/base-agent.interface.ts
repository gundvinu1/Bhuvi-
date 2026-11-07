import { AgentRole } from '@bhuvi/shared';

export interface StepPreviousOutput {
  stepKey: string;
  title: string;
  agent: AgentRole;
  summary: string;
  details?: Record<string, unknown>;
}

export interface AgentContext {
  planId: string;
  stepKey: string;
  stepTitle: string;
  stepDescription: string;
  userPrompt: string;
  previousOutputs?: StepPreviousOutput[];
}

export interface AgentExecutionProposal {
  actionType: string;
  description: string;
  data: Record<string, unknown>;
}

export interface AgentExecutionResult {
  success: boolean;
  agent: AgentRole;
  summary: string;
  details?: Record<string, unknown>;
  requiresApproval?: boolean;
  proposal?: AgentExecutionProposal;
  error?: string;
  durationMs?: number;
}

export interface BaseAgent {
  readonly role: AgentRole;
  readonly description: string;
  execute(context: AgentContext): Promise<AgentExecutionResult>;
}
