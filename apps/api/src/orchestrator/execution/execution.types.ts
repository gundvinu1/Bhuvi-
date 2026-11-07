import { PlanStatus, StepStatus } from '@bhuvi/shared';

export { PlanStatus, StepStatus };

export interface ExecutionSummary {
  planId: string;
  executionId: string;
  status: PlanStatus;
  completedSteps: number;
  totalSteps: number;
  error?: string;
}
