// ============================================================
// BHUVI – Message Intelligence Types
// Module 07: Message Classification, Analysis & Prioritization
// ============================================================

export type MessageCategory =
  | 'PERSONAL'
  | 'WORK'
  | 'EDUCATION'
  | 'FINANCIAL'
  | 'BUSINESS'
  | 'SOCIAL'
  | 'PROMOTIONAL'
  | 'TRANSACTIONAL'
  | 'NOTIFICATION'
  | 'OTHER';

export type MessagePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type MessageUrgency = 'URGENT' | 'TIME_SENSITIVE' | 'NORMAL' | 'NONE';

export type MessageIntent =
  | 'REQUEST'
  | 'QUESTION'
  | 'INFORMATION'
  | 'REMINDER'
  | 'INVITATION'
  | 'COMPLAINT'
  | 'CONFIRMATION'
  | 'OFFER'
  | 'OTHER';

export type MessageSentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED' | 'UNKNOWN';

export type MessageProcessingStatus =
  'RECEIVED' | 'VALIDATING' | 'PROCESSING' | 'ANALYZING' | 'COMPLETED' | 'FAILED' | 'RETRY_PENDING';

export type ActionItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ExtractedEntity {
  type: string;
  value: string;
}

export interface ExtractedActionItem {
  title: string;
  description?: string | null;
  priority: MessagePriority;
  dueDate?: string | null;
}

/**
 * Structured outcome of Message Intelligence Analysis
 */
export interface MessageAnalysisResult {
  category: MessageCategory;
  priority: MessagePriority;
  priorityExplanation?: string;
  urgency: MessageUrgency;
  intent: MessageIntent;
  sentiment: MessageSentiment;
  summary: string;
  requiresReply: boolean;
  requiresAction: boolean;
  confidence: number;
  actionItems: ExtractedActionItem[];
  entities: ExtractedEntity[];
}

/**
 * Stored Message Action Item DTO
 */
export interface MessageActionItemDto {
  id: string;
  messageId: string;
  userId: string;
  title: string;
  description?: string | null;
  priority: MessagePriority;
  dueDate?: string | null;
  status: ActionItemStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Stored Message Analysis DTO
 */
export interface MessageAnalysisDto {
  id: string;
  messageId: string;
  category: MessageCategory;
  priority: MessagePriority;
  priorityExplanation?: string | null;
  urgency: MessageUrgency;
  intent: MessageIntent;
  sentiment: MessageSentiment;
  summary: string;
  requiresReply: boolean;
  requiresAction: boolean;
  confidence: number;
  extractedEntities: ExtractedEntity[];
  analysisMetadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Message Label DTO
 */
export interface MessageLabelDto {
  id: string;
  userId: string;
  name: string;
  color?: string | null;
}

/**
 * Full Message DTO with optional analysis and action items
 */
export interface MessageDto {
  id: string;
  userId: string;
  source: string;
  senderName: string;
  senderIdentifier?: string | null;
  subject?: string | null;
  content: string;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  processingStatus: MessageProcessingStatus;
  analysis?: MessageAnalysisDto | null;
  actionItems?: MessageActionItemDto[];
  labels?: MessageLabelDto[];
  isDuplicate?: boolean;
}

/**
 * Message Intelligence Aggregate Stats
 */
export interface MessageStatsDto {
  totalMessages: number;
  highPriorityCount: number;
  urgentCount: number;
  requiresActionCount: number;
  requiresReplyCount: number;
  completedCount: number;
  pendingProcessingCount: number;
  categoryDistribution: Record<MessageCategory, number>;
}
