// ============================================================
// BHUVI Shared Package – WhatsApp Integration Types (Module 10)
// Official Meta WhatsApp Business Platform Cloud API
// ============================================================

import { MessageCategory, MessagePriority, MessageUrgency } from './message.types';

export type WhatsAppConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
export type WhatsAppMessageDirection = 'INCOMING' | 'OUTGOING';
export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'unknown';
export type WhatsAppDeliveryStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export type WhatsAppDraftApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SENT';

export interface WhatsAppConnectionDto {
  id: string;
  userId: string;
  businessAccountId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  displayName: string;
  status: WhatsAppConnectionStatus;
  lastActivityAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppContactDto {
  id: string;
  userId: string;
  connectionId: string;
  waId: string;
  name?: string | null;
  profileData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppConversationDto {
  id: string;
  userId: string;
  connectionId: string;
  contactId: string;
  status: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  contact?: WhatsAppContactDto | null;
  connection?: {
    id: string;
    displayPhoneNumber: string;
    displayName: string;
  } | null;
}

export interface WhatsAppMediaDto {
  id: string;
  messageId: string;
  mediaId: string;
  mimeType: string;
  filename?: string | null;
  fileSize?: number | null;
  storagePath?: string | null;
  createdAt: string;
}

export interface WhatsAppMessageDto {
  id: string;
  userId: string;
  connectionId: string;
  conversationId: string;
  externalMessageId: string;
  direction: WhatsAppMessageDirection;
  messageType: WhatsAppMessageType;
  textContent?: string | null;
  mediaMetadata?: Record<string, unknown> | null;
  deliveryStatus: WhatsAppDeliveryStatus;
  timestamp: string;
  messageId?: string | null;
  createdAt: string;
  updatedAt: string;
  media?: WhatsAppMediaDto[];
  analysis?: {
    category: MessageCategory;
    priority: MessagePriority;
    urgency: MessageUrgency;
    intent?: string;
    sentiment?: string;
    summary: string;
    requiresReply: boolean;
    requiresAction: boolean;
    confidence: number;
  } | null;
  actionItems?: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    dueDate?: string | null;
  }>;
}

export interface WhatsAppDraftDto {
  id: string;
  userId: string;
  connectionId: string;
  conversationId: string;
  recipientPhone: string;
  messageType: string;
  content: string;
  templateName?: string | null;
  templateParams?: Record<string, unknown> | null;
  approvalStatus: WhatsAppDraftApprovalStatus;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWhatsAppConnectionDto {
  businessAccountId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  displayName: string;
  accessToken: string;
}

export interface CreateWhatsAppDraftDto {
  connectionId: string;
  conversationId: string;
  recipientPhone: string;
  content: string;
  messageType?: WhatsAppMessageType;
  templateName?: string;
  templateParams?: Record<string, unknown>;
}

export interface ApproveWhatsAppDraftDto {
  draftId: string;
}

export interface SendWhatsAppDraftDto {
  draftId: string;
}

export interface WhatsAppSummaryDto {
  summary: string;
  actionItems: string[];
  urgentItems: string[];
  participants: string[];
  unreadCount: number;
}

export interface WhatsAppReplySuggestionDto {
  suggestions: Array<{
    tone: string;
    text: string;
    rationale: string;
  }>;
}

export interface WhatsAppAskRequestDto {
  question: string;
  connectionId?: string;
  conversationId?: string;
}

export interface WhatsAppAskResponseDto {
  answer: string;
  references: Array<{
    messageId: string;
    sender: string;
    timestamp: string;
    snippet: string;
  }>;
}

export interface WhatsAppStatsDto {
  totalConnections: number;
  activeConversations: number;
  totalMessages: number;
  unreadMessages: number;
  pendingDrafts: number;
}

// ============================================================
// Official Meta WhatsApp Business Cloud API Payload Definitions
// ============================================================

export interface MetaWebhookPayload {
  object: 'whatsapp_business_account';
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string; // WhatsApp Business Account ID
  changes: MetaWebhookChange[];
}

export interface MetaWebhookChange {
  value: MetaWebhookValue;
  field: 'messages';
}

export interface MetaWebhookValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: {
      name: string;
    };
    wa_id: string;
  }>;
  messages?: MetaIncomingMessage[];
  statuses?: MetaStatusUpdate[];
}

export interface MetaIncomingMessage {
  from: string;
  id: string; // wamid.HBg...
  timestamp: string; // epoch seconds string
  type: WhatsAppMessageType;
  text?: {
    body: string;
  };
  image?: MetaMediaPayload;
  document?: MetaMediaPayload & { filename?: string };
  audio?: MetaMediaPayload;
  video?: MetaMediaPayload;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contacts?: Array<{
    name: { formatted_name: string };
    phones?: Array<{ phone: string }>;
  }>;
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: { details: string };
  }>;
}

export interface MetaMediaPayload {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
}

export interface MetaStatusUpdate {
  id: string; // wamid
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    expiration_timestamp?: string;
    origin?: {
      type: string;
    };
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
  }>;
}
