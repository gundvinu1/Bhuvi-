// ============================================================
// BHUVI – AI Agent Orchestrator Types
// Module 06: Intent Analysis, Planning, Agents & Approvals
// ============================================================

export type IntentCategory =
  | 'GENERAL_QUESTION'
  | 'RESEARCH'
  | 'PLANNING'
  | 'COMMUNICATION'
  | 'TASK_MANAGEMENT'
  | 'MULTI_STEP'
  | 'UNKNOWN';

export type AgentRole = 'PLANNING' | 'RESEARCH' | 'COMMUNICATION' | 'TASK';

export type PlanStatus =
  'PENDING' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'WAITING_FOR_APPROVAL' | 'CANCELLED';

export type StepStatus =
  'PENDING' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'WAITING_FOR_APPROVAL' | 'CANCELLED';

export type ApprovalStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** Structured outcome of Intent Analysis */
export interface IntentAnalysisResult {
  intent: IntentCategory;
  explanation: string;
  confidence: number;
  selectedAgents: AgentRole[];
  clarificationNeeded: boolean;
  clarificationPrompt?: string;
}

/** Step within an Agent Plan */
export interface AgentPlanStepDto {
  id: string;
  stepKey: string;
  stepIndex: number;
  title: string;
  description: string;
  assignedAgent: AgentRole;
  dependencies: string[];
  status: StepStatus;
  requiresApproval: boolean;
  output?: Record<string, unknown> | null;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

/** Complete Agent Plan */
export interface AgentPlanDto {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  intentCategory: IntentCategory;
  status: PlanStatus;
  clarificationNeeded: boolean;
  explanation?: string | null;
  steps: AgentPlanStepDto[];
  pendingApprovalsCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** Human Approval Request */
export interface ApprovalRequestDto {
  id: string;
  planId: string;
  stepId?: string | null;
  userId: string;
  actionType: string;
  description: string;
  proposalData: Record<string, unknown>;
  status: ApprovalStatus;
  decisionReason?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

/** Request payload for creating a new orchestration plan */
export interface CreatePlanRequest {
  message: string;
}

/** Decision payload for approving or rejecting a proposal */
export interface ApprovalDecisionRequest {
  reason?: string;
}

/** Response returned when plan execution is triggered */
export interface ExecutePlanResponse {
  planId: string;
  status: PlanStatus;
  executionId: string;
  message: string;
}
