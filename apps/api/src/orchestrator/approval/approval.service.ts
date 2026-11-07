import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService, Prisma, ApprovalRequest } from '@bhuvi/database';
import { ApprovalRequestDto, CreateApprovalProposalInput } from './approval.types';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a pending human approval request in the database.
   */
  async createApprovalRequest(input: CreateApprovalProposalInput): Promise<ApprovalRequestDto> {
    this.logger.log(
      `Creating approval request for plan [${input.planId}], action: ${input.actionType}`,
    );

    const record = await this.prisma.approvalRequest.create({
      data: {
        planId: input.planId,
        stepId: input.stepId,
        userId: input.userId,
        actionType: input.actionType,
        description: input.description,
        proposalData: input.proposalData as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    return this.mapToDto(record);
  }

  /**
   * Approves a pending proposal. Enforces authenticated user ownership.
   */
  async approve(approvalId: string, userId: string, reason?: string): Promise<ApprovalRequestDto> {
    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      include: { plan: true },
    });

    if (!approval) {
      throw new NotFoundException(`Approval request with ID "${approvalId}" not found`);
    }

    if (approval.userId !== userId) {
      throw new ForbiddenException('You do not have permission to approve this proposal');
    }

    if (approval.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot approve proposal with status "${approval.status}". Only PENDING proposals can be approved.`,
      );
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id: approvalId },
      data: {
        status: 'APPROVED',
        decidedBy: userId,
        decidedAt: new Date(),
        decisionReason: reason || 'Approved by user action',
      },
    });

    // If linked to a step, update step status to READY so execution can resume
    if (approval.stepId) {
      await this.prisma.agentPlanStep.update({
        where: { id: approval.stepId },
        data: { status: 'READY' },
      });
    }

    this.logger.log(`Proposal [${approvalId}] APPROVED by user [${userId}]`);
    return this.mapToDto(updated);
  }

  /**
   * Rejects a pending proposal. Enforces authenticated user ownership.
   */
  async reject(approvalId: string, userId: string, reason?: string): Promise<ApprovalRequestDto> {
    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      include: { plan: true },
    });

    if (!approval) {
      throw new NotFoundException(`Approval request with ID "${approvalId}" not found`);
    }

    if (approval.userId !== userId) {
      throw new ForbiddenException('You do not have permission to reject this proposal');
    }

    if (approval.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot reject proposal with status "${approval.status}". Only PENDING proposals can be rejected.`,
      );
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id: approvalId },
      data: {
        status: 'REJECTED',
        decidedBy: userId,
        decidedAt: new Date(),
        decisionReason: reason || 'Rejected by user action',
      },
    });

    // If linked to a step, cancel step and plan
    if (approval.stepId) {
      await this.prisma.agentPlanStep.update({
        where: { id: approval.stepId },
        data: { status: 'CANCELLED' },
      });

      await this.prisma.agentPlan.update({
        where: { id: approval.planId },
        data: { status: 'CANCELLED' },
      });
    }

    this.logger.log(`Proposal [${approvalId}] REJECTED by user [${userId}]`);
    return this.mapToDto(updated);
  }

  /**
   * Lists all pending approval requests for the authenticated user.
   */
  async getPendingApprovals(userId: string): Promise<ApprovalRequestDto[]> {
    const approvals = await this.prisma.approvalRequest.findMany({
      where: {
        userId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    return approvals.map((a) => this.mapToDto(a));
  }

  private mapToDto(record: ApprovalRequest): ApprovalRequestDto {
    return {
      id: record.id,
      planId: record.planId,
      stepId: record.stepId,
      userId: record.userId,
      actionType: record.actionType,
      description: record.description,
      proposalData: (record.proposalData as Record<string, unknown>) || {},
      status: record.status as ApprovalRequestDto['status'],
      decisionReason: record.decisionReason,
      decidedBy: record.decidedBy,
      decidedAt: record.decidedAt ? record.decidedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
