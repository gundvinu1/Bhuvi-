import { AgentRole, IntentCategory } from '@bhuvi/shared';

export interface PlannedStepDefinition {
  stepKey: string;
  stepIndex: number;
  title: string;
  description: string;
  assignedAgent: AgentRole;
  dependencies: string[];
  requiresApproval: boolean;
}

export interface GeneratedPlan {
  title: string;
  intentCategory: IntentCategory;
  explanation: string;
  steps: PlannedStepDefinition[];
}

export interface RawPlannerModelOutput {
  title?: string;
  steps?: Array<{
    stepKey?: string;
    title?: string;
    description?: string;
    assignedAgent?: string;
    dependencies?: string[];
    requiresApproval?: boolean;
  }>;
}
