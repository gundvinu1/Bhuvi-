import { Injectable, Logger } from '@nestjs/common';
import { gmail_v1 } from 'googleapis';

export interface ParsedEmailAttachment {
  providerAttachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ParsedEmailMessage {
  providerMessageId: string;
  providerThreadId: string;
  senderName: string | null;
  senderEmail: string;
  recipientEmails: string[];
  ccEmails: string[];
  subject: string;
  snippet: string | null;
  bodyText: string;
  bodyHtml: string | null;
  receivedAt: Date;
  isRead: boolean;
  hasAttachments: boolean;
  labels: string[];
  attachments: ParsedEmailAttachment[];
}

@Injectable()
export class EmailParserService {
  private readonly logger = new Logger(EmailParserService.name);

  /**
   * Decodes Base64URL string returned by Gmail API into UTF-8 text.
   */
  decodeBase64Url(data: string): string {
    if (!data) return '';
    try {
      const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
      const padLen = (4 - (normalized.length % 4)) % 4;
      const padded = normalized + '='.repeat(padLen);
      return Buffer.from(padded, 'base64').toString('utf-8');
    } catch (err: unknown) {
      this.logger.warn(`Failed to decode base64url data: ${(err as Error).message}`);
      return '';
    }
  }

  /**
   * Parses sender information from 'From' header.
   * e.g., "Jane Smith <jane@example.com>" -> name: "Jane Smith", email: "jane@example.com"
   */
  parseSender(fromHeader: string): { name: string | null; email: string } {
    if (!fromHeader || !fromHeader.trim()) {
      return { name: null, email: 'unknown@sender.local' };
    }

    const trimmed = fromHeader.trim();
    const match = trimmed.match(/^(?:"?([^"]*)"?\s*)?<([^>]+)>$/);
    if (match) {
      const name = match[1]?.trim() || null;
      const email = match[2]?.trim().toLowerCase() || 'unknown@sender.local';
      return { name, email };
    }

    // Bare email or plain name
    if (trimmed.includes('@')) {
      return { name: null, email: trimmed.replace(/[<>]/g, '').trim().toLowerCase() };
    }

    return { name: trimmed, email: 'unknown@sender.local' };
  }

  /**
   * Splits comma-separated email list headers (To, Cc).
   */
  parseEmailList(headerValue?: string): string[] {
    if (!headerValue || !headerValue.trim()) return [];
    return headerValue
      .split(',')
      .map((item) => {
        const parsed = this.parseSender(item.trim());
        return parsed.email;
      })
      .filter((email) => email && email.includes('@'));
  }

  /**
   * Recursively extracts plain text, HTML, and attachment metadata from a MIME payload.
   */
  extractMimeParts(
    part?: gmail_v1.Schema$MessagePart,
    accumulatedText: string[] = [],
    accumulatedHtml: string[] = [],
    accumulatedAttachments: ParsedEmailAttachment[] = [],
  ): { text: string; html: string; attachments: ParsedEmailAttachment[] } {
    if (!part) {
      return {
        text: accumulatedText.join('\n\n'),
        html: accumulatedHtml.join('\n\n'),
        attachments: accumulatedAttachments,
      };
    }

    const mimeType = part.mimeType || '';
    const filename = part.filename?.trim();
    const attachmentId = part.body?.attachmentId;

    // Check if part represents an attachment
    if (filename && filename.length > 0 && attachmentId) {
      // Sanitize filename to prevent path traversal
      const sanitizedFilename = filename
        .replace(/\.\./g, '')
        .replace(/[/\\]/g, '_')
        .replace(/\0/g, '')
        .trim();
      accumulatedAttachments.push({
        providerAttachmentId: attachmentId,
        filename: sanitizedFilename,
        mimeType: mimeType || 'application/octet-stream',
        size: part.body?.size || 0,
      });
    }

    // Extract text content if body data is present
    if (part.body?.data) {
      const decoded = this.decodeBase64Url(part.body.data);
      if (mimeType.toLowerCase() === 'text/plain') {
        accumulatedText.push(decoded);
      } else if (mimeType.toLowerCase() === 'text/html') {
        accumulatedHtml.push(decoded);
      }
    }

    // Traverse nested subparts
    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        this.extractMimeParts(subPart, accumulatedText, accumulatedHtml, accumulatedAttachments);
      }
    }

    return {
      text: accumulatedText.join('\n\n').trim(),
      html: accumulatedHtml.join('\n\n').trim(),
      attachments: accumulatedAttachments,
    };
  }

  /**
   * Safely converts HTML content to readable plain text fallback.
   */
  htmlToPlainText(html: string): string {
    if (!html) return '';
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Parses full Gmail API message into structured model.
   */
  parseMessage(message: gmail_v1.Schema$Message): ParsedEmailMessage {
    const providerMessageId = message.id || '';
    const providerThreadId = message.threadId || providerMessageId;
    const labels = message.labelIds || [];
    const isRead = !labels.includes('UNREAD');

    const headers = message.payload?.headers || [];
    const headerMap = new Map<string, string>();
    for (const h of headers) {
      if (h.name && h.value) {
        headerMap.set(h.name.toLowerCase(), h.value);
      }
    }

    const fromVal = headerMap.get('from') || '';
    const { name: senderName, email: senderEmail } = this.parseSender(fromVal);
    const recipientEmails = this.parseEmailList(headerMap.get('to'));
    const ccEmails = this.parseEmailList(headerMap.get('cc'));
    const subject = headerMap.get('subject')?.trim() || '(No Subject)';
    const snippet = message.snippet || null;

    let receivedAt = new Date();
    const dateHeader = headerMap.get('date');
    if (dateHeader) {
      const parsedDate = new Date(dateHeader);
      if (!isNaN(parsedDate.getTime())) {
        receivedAt = parsedDate;
      }
    } else if (message.internalDate) {
      const ms = parseInt(message.internalDate, 10);
      if (!isNaN(ms)) {
        receivedAt = new Date(ms);
      }
    }

    const { text, html, attachments } = this.extractMimeParts(message.payload);

    // Prefer plain text; fallback to sanitized HTML converted to text; fallback to snippet
    let bodyText = text;
    if (!bodyText && html) {
      bodyText = this.htmlToPlainText(html);
    }
    if (!bodyText && snippet) {
      bodyText = snippet;
    }
    if (!bodyText) {
      bodyText = '(Empty email message)';
    }

    // Limit maximum text length to 100,000 characters
    if (bodyText.length > 100000) {
      bodyText = bodyText.slice(0, 100000) + '\n\n[Content truncated at 100,000 characters]';
    }

    return {
      providerMessageId,
      providerThreadId,
      senderName,
      senderEmail,
      recipientEmails,
      ccEmails,
      subject,
      snippet,
      bodyText,
      bodyHtml: html || null,
      receivedAt,
      isRead,
      hasAttachments: attachments.length > 0,
      labels,
      attachments,
    };
  }
}
