import { APP_NAME, APP_VERSION } from '@bhuvi/shared';
import { PrismaClient } from '@bhuvi/database';
import { BhuviWorker, loadConfig } from './main';
import {
  JOB_INFRASTRUCTURE_CHECK,
  JOB_EXECUTE_PLAN,
  JOB_ANALYZE_MESSAGE,
  JOB_PROCESS_MEMORY,
  InfrastructureCheckPayload,
  InfrastructureCheckResult,
  ExecutePlanPayload,
  ExecutePlanResult,
  AnalyzeMessagePayload,
  AnalyzeMessageResult,
  ProcessMemoryPayload,
  ProcessMemoryResult,
  Job,
} from '@bhuvi/queue';

describe('BhuviWorker Foundation & Queue Integration', () => {
  it('should have valid application metadata', () => {
    expect(APP_NAME).toBe('BHUVI');
    expect(APP_VERSION).toBe('1.0.0');
  });

  it('should have standard node environment available', () => {
    expect(process.version).toBeDefined();
    expect(typeof process.version).toBe('string');
  });

  it('should load default worker configuration safely', () => {
    const config = loadConfig();
    expect(config.nodeEnv).toBeDefined();
    expect(config.port).toBe(3002);
  });

  it('should process infrastructure-check job and return success result', async () => {
    const worker = new BhuviWorker({ nodeEnv: 'test', port: 3002 });
    const payload: InfrastructureCheckPayload = {
      checkId: 'check-12345',
      source: 'test-suite',
      timestamp: new Date().toISOString(),
      meta: { testRun: true },
    };

    const mockJob = {
      id: 'job-1',
      name: JOB_INFRASTRUCTURE_CHECK,
      data: payload,
    } as unknown as Job;

    const result = (await worker.processJob(mockJob)) as InfrastructureCheckResult;
    expect(result.status).toBe('success');
    expect(result.checkId).toBe('check-12345');
    expect(result.workerId).toBe(worker.getWorkerId());
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.processedAt).toBeDefined();
  });

  it('should process execute-plan job and return completion result', async () => {
    const worker = new BhuviWorker({ nodeEnv: 'test', port: 3002 });
    const payload: ExecutePlanPayload = {
      planId: 'plan-123',
      userId: 'user-456',
      executionId: 'exec-789',
    };

    const mockJob = {
      id: 'job-exec-1',
      name: JOB_EXECUTE_PLAN,
      data: payload,
    } as unknown as Job;

    const result = (await worker.processJob(mockJob)) as ExecutePlanResult;
    expect(result.status).toBe('COMPLETED');
    expect(result.planId).toBe('plan-123');
    expect(result.executionId).toBe('exec-789');
    expect(result.completedSteps).toBe(1);
  });

  it('should skip redundant worker execution if plan is already COMPLETED in database', async () => {
    const mockPrisma = {
      agentPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'plan-123',
          status: 'COMPLETED',
          steps: [{ id: 's-1' }, { id: 's-2' }],
        }),
      },
      agentExecution: {
        updateMany: jest.fn(),
      },
    };

    const worker = new BhuviWorker(
      { nodeEnv: 'test', port: 3002 },
      mockPrisma as unknown as PrismaClient,
    );
    const mockJob = {
      id: 'job-exec-2',
      name: JOB_EXECUTE_PLAN,
      data: { planId: 'plan-123', executionId: 'exec-999' },
    } as unknown as Job;

    const result = (await worker.processJob(mockJob)) as ExecutePlanResult;
    expect(result.status).toBe('COMPLETED');
    expect(result.completedSteps).toBe(2);
    expect(mockPrisma.agentExecution.updateMany).not.toHaveBeenCalled();
  });

  it('should respect cancellation and skip execution if plan is CANCELLED in database', async () => {
    const mockPrisma = {
      agentPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'plan-123',
          status: 'CANCELLED',
          steps: [{ id: 's-1' }],
        }),
      },
      agentExecution: {
        updateMany: jest.fn(),
      },
    };

    const worker = new BhuviWorker(
      { nodeEnv: 'test', port: 3002 },
      mockPrisma as unknown as PrismaClient,
    );
    const mockJob = {
      id: 'job-exec-3',
      name: JOB_EXECUTE_PLAN,
      data: { planId: 'plan-123', executionId: 'exec-888' },
    } as unknown as Job;

    const result = (await worker.processJob(mockJob)) as ExecutePlanResult;
    expect(result.status).toBe('CANCELLED');
    expect(result.completedSteps).toBe(0);
    expect(mockPrisma.agentExecution.updateMany).not.toHaveBeenCalled();
  });

  it('should handle missing plan gracefully by returning FAILED status', async () => {
    const mockPrisma = {
      agentPlan: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      agentExecution: {
        updateMany: jest.fn(),
      },
    };

    const worker = new BhuviWorker(
      { nodeEnv: 'test', port: 3002 },
      mockPrisma as unknown as PrismaClient,
    );
    const mockJob = {
      id: 'job-exec-4',
      name: JOB_EXECUTE_PLAN,
      data: { planId: 'nonexistent-plan', executionId: 'exec-000' },
    } as unknown as Job;

    const result = (await worker.processJob(mockJob)) as ExecutePlanResult;
    expect(result.status).toBe('FAILED');
  });

  it('should process analyze-message job successfully and update DB status', async () => {
    const mockPrisma = {
      message: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'msg-101',
          processingStatus: 'RECEIVED',
          analysis: null,
        }),
        update: jest.fn().mockResolvedValue({ id: 'msg-101', processingStatus: 'PROCESSING' }),
      },
    };

    const worker = new BhuviWorker(
      { nodeEnv: 'test', port: 3002 },
      mockPrisma as unknown as PrismaClient,
    );
    const mockJob = {
      id: 'job-msg-1',
      name: JOB_ANALYZE_MESSAGE,
      data: { messageId: 'msg-101', userId: 'user-1' } as AnalyzeMessagePayload,
    } as unknown as Job;

    const result = (await worker.processJob(mockJob)) as AnalyzeMessageResult;
    expect(result.status).toBe('COMPLETED');
    expect(result.messageId).toBe('msg-101');
    expect(mockPrisma.message.update).toHaveBeenCalledWith({
      where: { id: 'msg-101' },
      data: { processingStatus: 'PROCESSING' },
    });
  });

  it('should skip already analyzed message unless force is true', async () => {
    const mockPrisma = {
      message: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'msg-102',
          processingStatus: 'COMPLETED',
          analysis: { category: 'WORK', priority: 'HIGH' },
        }),
        update: jest.fn(),
      },
    };

    const worker = new BhuviWorker(
      { nodeEnv: 'test', port: 3002 },
      mockPrisma as unknown as PrismaClient,
    );
    const mockJob = {
      id: 'job-msg-2',
      name: JOB_ANALYZE_MESSAGE,
      data: { messageId: 'msg-102', userId: 'user-1' } as AnalyzeMessagePayload,
    } as unknown as Job;

    const result = (await worker.processJob(mockJob)) as AnalyzeMessageResult;
    expect(result.status).toBe('SKIPPED');
    expect(result.category).toBe('WORK');
    expect(result.priority).toBe('HIGH');
    expect(mockPrisma.message.update).not.toHaveBeenCalled();
  });

  it('should return FAILED status when message is not found in database', async () => {
    const mockPrisma = {
      message: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };

    const worker = new BhuviWorker(
      { nodeEnv: 'test', port: 3002 },
      mockPrisma as unknown as PrismaClient,
    );
    const mockJob = {
      id: 'job-msg-3',
      name: JOB_ANALYZE_MESSAGE,
      data: { messageId: 'msg-missing', userId: 'user-1' } as AnalyzeMessagePayload,
    } as unknown as Job;

    const result = (await worker.processJob(mockJob)) as AnalyzeMessageResult;
    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('not found');
  });

  it('should process process-memory job successfully and update DB status', async () => {
    const mockPrisma = {
      memory: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'mem-101',
          userId: 'user-1',
          content: 'BHUVI personal memory long-term knowledge text for testing worker pipeline.',
          status: 'PENDING',
          chunks: [],
        }),
        update: jest.fn().mockResolvedValue({ id: 'mem-101', status: 'COMPLETED' }),
      },
      memoryChunk: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'chk-created' }),
      },
    };

    const worker = new BhuviWorker(
      { nodeEnv: 'test', port: 3002 },
      mockPrisma as unknown as PrismaClient,
    );
    const mockJob = {
      id: 'job-mem-1',
      name: JOB_PROCESS_MEMORY,
      data: { memoryId: 'mem-101', userId: 'user-1' } as ProcessMemoryPayload,
    } as unknown as Job;

    const result = (await worker.processJob(mockJob)) as ProcessMemoryResult;
    expect(result.status).toBe('COMPLETED');
    expect(result.memoryId).toBe('mem-101');
    expect(result.chunksCount).toBe(1);
    expect(mockPrisma.memory.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'mem-101' },
      data: { status: 'PROCESSING', errorMessage: null },
    });
    expect(mockPrisma.memoryChunk.deleteMany).toHaveBeenCalledWith({
      where: { memoryId: 'mem-101' },
    });
    expect(mockPrisma.memoryChunk.create).toHaveBeenCalled();
    expect(mockPrisma.memory.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'mem-101' },
      data: { status: 'COMPLETED', errorMessage: null },
    });
  });

  it('should skip already processed memory unless force is true', async () => {
    const mockPrisma = {
      memory: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'mem-102',
          userId: 'user-1',
          status: 'COMPLETED',
          chunks: [{ id: 'chk-1' }, { id: 'chk-2' }],
        }),
        update: jest.fn(),
      },
      memoryChunk: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const worker = new BhuviWorker(
      { nodeEnv: 'test', port: 3002 },
      mockPrisma as unknown as PrismaClient,
    );
    const mockJob = {
      id: 'job-mem-2',
      name: JOB_PROCESS_MEMORY,
      data: { memoryId: 'mem-102', userId: 'user-1' } as ProcessMemoryPayload,
    } as unknown as Job;

    const result = (await worker.processJob(mockJob)) as ProcessMemoryResult;
    expect(result.status).toBe('SKIPPED');
    expect(result.chunksCount).toBe(2);
    expect(mockPrisma.memory.update).not.toHaveBeenCalled();
  });

  it('should mark memory as FAILED and rethrow error when chunking or embedding fails', async () => {
    const mockPrisma = {
      memory: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'mem-error',
          userId: 'user-1',
          content: 'Failing memory content',
          status: 'PENDING',
          chunks: [],
        }),
        update: jest.fn().mockResolvedValue({ id: 'mem-error', status: 'FAILED' }),
      },
      memoryChunk: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockRejectedValue(new Error('Database write failure')),
      },
    };

    const worker = new BhuviWorker(
      { nodeEnv: 'test', port: 3002 },
      mockPrisma as unknown as PrismaClient,
    );
    const mockJob = {
      id: 'job-mem-fail',
      name: JOB_PROCESS_MEMORY,
      data: { memoryId: 'mem-error', userId: 'user-1' } as ProcessMemoryPayload,
    } as unknown as Job;

    await expect(worker.processJob(mockJob)).rejects.toThrow('Database write failure');
    expect(mockPrisma.memory.update).toHaveBeenCalledWith({
      where: { id: 'mem-error' },
      data: { status: 'FAILED', errorMessage: 'Database write failure' },
    });
  });

  it('should return FAILED status when memory is not found in database', async () => {
    const mockPrisma = {
      memory: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };

    const worker = new BhuviWorker(
      { nodeEnv: 'test', port: 3002 },
      mockPrisma as unknown as PrismaClient,
    );
    const mockJob = {
      id: 'job-mem-3',
      name: JOB_PROCESS_MEMORY,
      data: { memoryId: 'mem-missing', userId: 'user-1' } as ProcessMemoryPayload,
    } as unknown as Job;

    const result = (await worker.processJob(mockJob)) as ProcessMemoryResult;
    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('not found');
  });

  it('should handle unknown job gracefully without crashing', async () => {
    const worker = new BhuviWorker({ nodeEnv: 'test', port: 3002 });
    const mockJob = {
      id: 'job-unknown',
      name: 'nonexistent-job-type',
      data: {},
    } as unknown as Job;

    const result = (await worker.processJob(mockJob)) as { status: string; reason: string };
    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('unknown_job_type');
  });
});
