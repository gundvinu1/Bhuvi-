import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorService } from './orchestrator.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { SafeUser } from '@bhuvi/shared';

describe('OrchestratorController', () => {
  let controller: OrchestratorController;
  let service: OrchestratorService;

  const mockUser: SafeUser = {
    id: 'user-uuid-1',
    name: 'Vinayak Gund',
    email: 'vinayak@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockOrchestratorService = {
    createPlan: jest.fn(),
    listPlans: jest.fn(),
    getPlan: jest.fn(),
    executePlan: jest.fn(),
    cancelPlan: jest.fn(),
    approveProposal: jest.fn(),
    rejectProposal: jest.fn(),
    getPendingApprovals: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrchestratorController],
      providers: [
        {
          provide: OrchestratorService,
          useValue: mockOrchestratorService,
        },
      ],
    }).compile();

    controller = module.get<OrchestratorController>(OrchestratorController);
    service = module.get<OrchestratorService>(OrchestratorService);
    jest.clearAllMocks();
  });

  describe('POST /plans (createPlan)', () => {
    it('calls service.createPlan and returns formatted ApiResponse', async () => {
      mockOrchestratorService.createPlan.mockResolvedValue({
        id: 'plan-1',
        title: 'Meeting Prep Plan',
        prompt: 'Prepare for meeting',
        intentCategory: 'PLANNING',
        status: 'PENDING',
        steps: [],
      });

      const dto: CreatePlanDto = { message: 'Prepare for meeting' };
      const res = await controller.createPlan(dto, mockUser);

      expect(res.success).toBe(true);
      expect(res.data.id).toBe('plan-1');
      expect(service.createPlan).toHaveBeenCalledWith(mockUser.id, dto.message);
    });

    it('validates CreatePlanDto with ValidationPipe: accepts valid message', async () => {
      const target = new ValidationPipe({ whitelist: true, transform: true });
      const metadata: ArgumentMetadata = { type: 'body', metatype: CreatePlanDto };

      const validObj = { message: 'Help me prepare for tomorrow meeting' };
      const result = await target.transform(validObj, metadata);
      expect(result.message).toBe('Help me prepare for tomorrow meeting');
    });

    it('validates CreatePlanDto with ValidationPipe: rejects missing message or prompt key', async () => {
      const target = new ValidationPipe({ whitelist: true, transform: true });
      const metadata: ArgumentMetadata = { type: 'body', metatype: CreatePlanDto };

      // Inconsistent contract with "prompt" instead of "message"
      const invalidPromptObj = { prompt: 'Help me prepare for tomorrow meeting' };
      await expect(target.transform(invalidPromptObj, metadata)).rejects.toThrow(
        BadRequestException,
      );

      // Missing message entirely
      await expect(target.transform({}, metadata)).rejects.toThrow(BadRequestException);
    });

    it('validates CreatePlanDto with ValidationPipe: rejects empty or whitespace-only message', async () => {
      const target = new ValidationPipe({ whitelist: true, transform: true });
      const metadata: ArgumentMetadata = { type: 'body', metatype: CreatePlanDto };

      await expect(target.transform({ message: '' }, metadata)).rejects.toThrow(
        BadRequestException,
      );
      await expect(target.transform({ message: '   ' }, metadata)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('validates CreatePlanDto with ValidationPipe: rejects message exceeding 4000 characters', async () => {
      const target = new ValidationPipe({ whitelist: true, transform: true });
      const metadata: ArgumentMetadata = { type: 'body', metatype: CreatePlanDto };

      const longMessage = 'a'.repeat(4001);
      await expect(target.transform({ message: longMessage }, metadata)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('GET /plans (listPlans)', () => {
    it('returns paginated plans list', async () => {
      mockOrchestratorService.listPlans.mockResolvedValue({
        plans: [{ id: 'plan-1', title: 'Plan 1' }],
        total: 1,
        page: 1,
        limit: 10,
      });

      const res = await controller.listPlans({ page: 1, limit: 10 }, mockUser);

      expect(res.success).toBe(true);
      expect(res.data.length).toBe(1);
      expect(res.meta?.['pagination']).toBeDefined();
    });
  });

  describe('POST /plans/:id/execute (executePlan)', () => {
    it('triggers plan execution and returns execution response', async () => {
      mockOrchestratorService.executePlan.mockResolvedValue({
        planId: 'plan-1',
        status: 'COMPLETED',
        executionId: 'exec-1',
        message: 'Completed',
      });

      const res = await controller.executePlan('plan-1', mockUser);

      expect(res.success).toBe(true);
      expect(res.data.status).toBe('COMPLETED');
      expect(service.executePlan).toHaveBeenCalledWith('plan-1', mockUser.id);
    });
  });

  describe('POST /approvals/:id/approve', () => {
    it('approves proposal and returns approval result', async () => {
      mockOrchestratorService.approveProposal.mockResolvedValue({
        id: 'appr-1',
        status: 'APPROVED',
      });

      const res = await controller.approveProposal('appr-1', { reason: 'Approved' }, mockUser);

      expect(res.success).toBe(true);
      expect(res.data.status).toBe('APPROVED');
      expect(service.approveProposal).toHaveBeenCalledWith('appr-1', mockUser.id, 'Approved');
    });
  });

  describe('CreatePlanDto Validation', () => {
    const target = new ValidationPipe({ transform: true, whitelist: true });
    const metadata: ArgumentMetadata = { type: 'body', metatype: CreatePlanDto, data: '' };

    it('accepts valid non-empty message', async () => {
      const dto = { message: 'Plan tomorrow sync' };
      const result = await target.transform(dto, metadata);
      expect(result).toEqual(dto);
    });

    it('rejects empty message with BadRequestException', async () => {
      const dto = { message: '   ' };
      await expect(target.transform(dto, metadata)).rejects.toThrow(BadRequestException);
    });

    it('rejects oversized message exceeding 4000 characters', async () => {
      const dto = { message: 'm'.repeat(4001) };
      await expect(target.transform(dto, metadata)).rejects.toThrow(BadRequestException);
    });
  });
});
