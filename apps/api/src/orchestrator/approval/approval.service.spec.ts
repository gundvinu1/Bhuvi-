import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { PrismaService } from '@bhuvi/database';

describe('ApprovalService', () => {
  let service: ApprovalService;

  const mockPrisma = {
    approvalRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    agentPlanStep: {
      update: jest.fn(),
    },
    agentPlan: {
      update: jest.fn(),
    },
  };

  beforeEach(() => {
    service = new ApprovalService(mockPrisma as unknown as PrismaService);
    jest.clearAllMocks();
  });

  it('creates an approval request with PENDING status', async () => {
    mockPrisma.approvalRequest.create.mockResolvedValue({
      id: 'appr-1',
      planId: 'plan-1',
      stepId: 'step-1',
      userId: 'usr-1',
      actionType: 'PROPOSAL_MESSAGE_DRAFT',
      description: 'Draft email ready for review',
      proposalData: { draft: 'Hello...' },
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createApprovalRequest({
      planId: 'plan-1',
      stepId: 'step-1',
      userId: 'usr-1',
      actionType: 'PROPOSAL_MESSAGE_DRAFT',
      description: 'Draft email ready for review',
      proposalData: { draft: 'Hello...' },
    });

    expect(result.id).toBe('appr-1');
    expect(result.status).toBe('PENDING');
  });

  it('approves proposal, records decision metadata, and updates step status to READY', async () => {
    mockPrisma.approvalRequest.findUnique.mockResolvedValue({
      id: 'appr-1',
      planId: 'plan-1',
      stepId: 'step-1',
      userId: 'usr-1',
      status: 'PENDING',
    });

    mockPrisma.approvalRequest.update.mockResolvedValue({
      id: 'appr-1',
      planId: 'plan-1',
      stepId: 'step-1',
      userId: 'usr-1',
      actionType: 'PROPOSAL_MESSAGE_DRAFT',
      description: 'Draft email',
      proposalData: {},
      status: 'APPROVED',
      decidedBy: 'usr-1',
      decidedAt: new Date(),
      decisionReason: 'Looks good',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.approve('appr-1', 'usr-1', 'Looks good');

    expect(result.status).toBe('APPROVED');
    expect(result.decisionReason).toBe('Looks good');
    expect(mockPrisma.agentPlanStep.update).toHaveBeenCalledWith({
      where: { id: 'step-1' },
      data: { status: 'READY' },
    });
  });

  it('rejects proposal and cancels linked plan and step', async () => {
    mockPrisma.approvalRequest.findUnique.mockResolvedValue({
      id: 'appr-1',
      planId: 'plan-1',
      stepId: 'step-1',
      userId: 'usr-1',
      status: 'PENDING',
    });

    mockPrisma.approvalRequest.update.mockResolvedValue({
      id: 'appr-1',
      planId: 'plan-1',
      stepId: 'step-1',
      userId: 'usr-1',
      actionType: 'PROPOSAL_MESSAGE_DRAFT',
      description: 'Draft email',
      proposalData: {},
      status: 'REJECTED',
      decidedBy: 'usr-1',
      decidedAt: new Date(),
      decisionReason: 'Too informal',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.reject('appr-1', 'usr-1', 'Too informal');

    expect(result.status).toBe('REJECTED');
    expect(mockPrisma.agentPlanStep.update).toHaveBeenCalledWith({
      where: { id: 'step-1' },
      data: { status: 'CANCELLED' },
    });
    expect(mockPrisma.agentPlan.update).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { status: 'CANCELLED' },
    });
  });

  it('throws ForbiddenException if a user attempts to approve another user proposal', async () => {
    mockPrisma.approvalRequest.findUnique.mockResolvedValue({
      id: 'appr-1',
      planId: 'plan-1',
      userId: 'usr-OWNER',
      status: 'PENDING',
    });

    await expect(service.approve('appr-1', 'usr-ATTACKER')).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException if a user attempts to reject another user proposal', async () => {
    mockPrisma.approvalRequest.findUnique.mockResolvedValue({
      id: 'appr-1',
      planId: 'plan-1',
      userId: 'usr-OWNER',
      status: 'PENDING',
    });

    await expect(service.reject('appr-1', 'usr-ATTACKER')).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException if proposal is not PENDING', async () => {
    mockPrisma.approvalRequest.findUnique.mockResolvedValue({
      id: 'appr-1',
      planId: 'plan-1',
      userId: 'usr-1',
      status: 'APPROVED', // Already decided
    });

    await expect(service.approve('appr-1', 'usr-1')).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException if approval does not exist', async () => {
    mockPrisma.approvalRequest.findUnique.mockResolvedValue(null);

    await expect(service.approve('nonexistent', 'usr-1')).rejects.toThrow(NotFoundException);
  });
});
