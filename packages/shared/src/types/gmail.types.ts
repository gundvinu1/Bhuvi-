import { MessageCategory, MessagePriority, MessageUrgency } from './message.types';

export type GmailConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'REQUIRES_REAUTH' | 'ERROR';
export type GmailSyncStatus = 'IDLE' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED';
export type GmailAttachmentDownloadStatus = 'METADATA_ONLY' | 'DOWNLOADED' | 'FAILED';

export interface GmailConnectionDto {
  id: string;
  userId: string;
  googleAccountEmail: string;
  googleAccountId?: string | null;
  connectionStatus: GmailConnectionStatus;
  scopes: string[];
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GmailAttachmentDto {
  id: string;
  gmailMessageId: string;
  providerAttachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  downloadStatus: GmailAttachmentDownloadStatus;
  createdAt: string;
}

export interface GmailMessageDto {
  id: string;
  userId: string;
  gmailConnectionId: string;
  accountEmail?: string;
  providerMessageId: string;
  providerThreadId: string;
  senderName?: string | null;
  senderEmail: string;
  recipientEmails: string[];
  ccEmails: string[];
  subject: string;
  snippet?: string | null;
  bodyText: string;
  bodyHtml?: string | null;
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
  labels: string[];
  syncStatus: string;
  messageId?: string | null;
  analysis?: {
    category: MessageCategory;
    priority: MessagePriority;
    urgency: MessageUrgency;
    summary: string;
    requiresReply: boolean;
    requiresAction: boolean;
    confidence: number;
  } | null;
  actionItems?: Array<{
    id: string;
    title: string;
    description?: string | null;
    priority: string;
    dueDate?: string | null;
    status: string;
  }>;
  attachments?: GmailAttachmentDto[];
  createdAt: string;
  updatedAt: string;
}

export interface GmailSyncStateDto {
  id: string;
  userId: string;
  gmailConnectionId: string;
  lastHistoryId?: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastAttemptAt: string;
  syncStatus: GmailSyncStatus;
  errorMessage?: string | null;
  syncedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GmailAccountStatDto {
  connectionId: string;
  googleAccountEmail: string;
  connectionStatus: GmailConnectionStatus;
  totalEmails: number;
  unreadEmails: number;
  importantEmails: number;
  requiresActionCount: number;
  lastSyncedAt?: string | null;
}

export interface GmailSyncStatsDto {
  totalEmails: number;
  unreadEmails: number;
  importantEmails: number;
  requiresReplyCount: number;
  requiresActionCount: number;
  lastSyncedAt?: string | null;
  syncStatus: GmailSyncStatus;
  accounts?: GmailAccountStatDto[];
}

export interface GmailSuggestedReplyDto {
  messageId: string;
  to: string;
  subject: string;
  suggestedBody: string;
  tone: string;
  explanation?: string;
}

export interface GmailCreateDraftDto {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  connectionId?: string;
}

export interface GmailDraftCreatedResult {
  draftId: string;
  messageId?: string;
  threadId?: string;
  to: string;
  subject: string;
  accountEmail?: string;
  connectionId?: string;
}

export interface GmailConnectUrlResponse {
  url: string;
  state: string;
}

export interface GmailSummaryResponse {
  messageId: string;
  summary: string;
  keyPoints: string[];
  urgency: string;
  priority: string;
  category: string;
  requiresReply: boolean;
  requiresAction: boolean;
}

export interface QueryGmailMessagesDto {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  priority?: string;
  unreadOnly?: boolean;
  importantOnly?: boolean;
  connectionId?: string;
}

export interface AskGmailEmailsDto {
  question: string;
  connectionId?: string;
}

export interface PaginatedGmailMessagesResponse {
  messages: GmailMessageDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
