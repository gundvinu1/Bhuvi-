import { APP_NAME, APP_VERSION } from '@bhuvi/shared';
import { BhuviWorker, loadConfig } from './main';
import {
  JOB_INFRASTRUCTURE_CHECK,
  JOB_EXECUTE_PLAN,
  InfrastructureCheckPayload,
  InfrastructureCheckResult,
  ExecutePlanPayload,
  ExecutePlanResult,
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
