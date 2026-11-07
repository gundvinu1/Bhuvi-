import { ApprovalStatus, ApprovalRequestDto } from '@bhuvi/shared';

export { ApprovalStatus, ApprovalRequestDto };

export interface CreateApprovalProposalInput {
  planId: string;
  stepId?: string;
  userId: string;
  actionType: string;
  description: string;
  proposalData: Record<string, unknown>;
}
