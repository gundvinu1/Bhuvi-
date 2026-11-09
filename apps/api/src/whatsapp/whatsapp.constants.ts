// ============================================================
// BHUVI WhatsApp Integration Constants (Module 10)
// ============================================================

export const META_GRAPH_API_BASE = 'https://graph.facebook.com';
export const DEFAULT_WHATSAPP_API_VERSION = 'v20.0';

export const UNTRUSTED_WHATSAPP_START = '<untrusted_whatsapp_message>';
export const UNTRUSTED_WHATSAPP_END = '</untrusted_whatsapp_message>';

export const WHATSAPP_REPLY_TONES = ['Professional', 'Friendly', 'Urgent', 'Direct'] as const;

export type WhatsAppReplyTone = (typeof WHATSAPP_REPLY_TONES)[number];
