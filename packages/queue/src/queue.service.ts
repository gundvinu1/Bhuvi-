import { Queue } from 'bullmq';
import {
  DEFAULT_QUEUE_NAME,
  JOB_INFRASTRUCTURE_CHECK,
  JOB_EXECUTE_PLAN,
  JOB_ANALYZE_MESSAGE,
  JOB_PROCESS_MEMORY,
  JOB_SYNC_GMAIL,
  JOB_PROCESS_WHATSAPP_WEBHOOK,
  JOB_SEND_WHATSAPP_APPROVED_MESSAGE,
  JOB_UPDATE_WHATSAPP_MESSAGE_STATUS,
} from './queue.constants';
import {
  InfrastructureCheckPayload,
  ExecutePlanPayload,
  AnalyzeMessagePayload,
  ProcessMemoryPayload,
  SyncGmailPayload,
  ProcessWhatsAppWebhookPayload,
  SendWhatsAppApprovedMessagePayload,
  UpdateWhatsAppMessageStatusPayload,
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

/**
 * Enqueues a Gmail inbox synchronization job.
 */
export async function enqueueSyncGmail(queue: Queue, payload: SyncGmailPayload) {
  return queue.add(JOB_SYNC_GMAIL, payload, {
    jobId: `gmail-sync-${payload.connectionId}-${Date.now()}`,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: 50,
    removeOnFail: 200,
  });
}

/**
 * Enqueues a WhatsApp webhook processing job.
 */
export async function enqueueProcessWhatsAppWebhook(
  queue: Queue,
  payload: ProcessWhatsAppWebhookPayload,
) {
  return queue.add(JOB_PROCESS_WHATSAPP_WEBHOOK, payload, {
    jobId: `wa-webhook-${payload.eventId}`,
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
 * Enqueues an approved WhatsApp message send job.
 */
export async function enqueueSendWhatsAppApprovedMessage(
  queue: Queue,
  payload: SendWhatsAppApprovedMessagePayload,
) {
  return queue.add(JOB_SEND_WHATSAPP_APPROVED_MESSAGE, payload, {
    jobId: `wa-send-${payload.draftId}`,
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
 * Enqueues a WhatsApp message status update job.
 */
export async function enqueueUpdateWhatsAppMessageStatus(
  queue: Queue,
  payload: UpdateWhatsAppMessageStatusPayload,
) {
  return queue.add(JOB_UPDATE_WHATSAPP_MESSAGE_STATUS, payload, {
    jobId: `wa-status-${payload.eventId}-${payload.status}`,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}
