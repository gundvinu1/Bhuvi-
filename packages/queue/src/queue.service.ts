import { Queue } from 'bullmq';
import {
  DEFAULT_QUEUE_NAME,
  JOB_INFRASTRUCTURE_CHECK,
  JOB_EXECUTE_PLAN,
  JOB_ANALYZE_MESSAGE,
  JOB_PROCESS_MEMORY,
} from './queue.constants';
import {
  InfrastructureCheckPayload,
  ExecutePlanPayload,
  AnalyzeMessagePayload,
  ProcessMemoryPayload,
} from './queue.types';
import { getRedisConnectionOptions } from './queue.config';

/**
 * Creates an instance of the default BHUVI BullMQ queue.
 */
export function createDefaultQueue(name = DEFAULT_QUEUE_NAME): Queue {
  return new Queue(name, {
    connection: getRedisConnectionOptions(),
  });
}

/**
 * Enqueues a standardized infrastructure diagnostic check job.
 */
export async function enqueueInfrastructureCheck(
  queue: Queue,
  payload: InfrastructureCheckPayload,
) {
  return queue.add(JOB_INFRASTRUCTURE_CHECK, payload, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}

/**
 * Enqueues an execute-plan job for asynchronous worker processing.
 */
export async function enqueueExecutePlan(queue: Queue, payload: ExecutePlanPayload) {
  return queue.add(JOB_EXECUTE_PLAN, payload, {
    jobId: `plan-exec-${payload.planId}-${payload.executionId}`,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}

/**
 * Enqueues an analyze-message job for asynchronous background processing.
 */
export async function enqueueAnalyzeMessage(queue: Queue, payload: AnalyzeMessagePayload) {
  return queue.add(JOB_ANALYZE_MESSAGE, payload, {
    jobId: `msg-analyze-${payload.messageId}`,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}

/**
 * Enqueues a memory processing job for background chunking and embedding generation.
 */
export async function enqueueProcessMemory(queue: Queue, payload: ProcessMemoryPayload) {
  return queue.add(JOB_PROCESS_MEMORY, payload, {
    jobId: `mem-process-${payload.memoryId}`,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}
