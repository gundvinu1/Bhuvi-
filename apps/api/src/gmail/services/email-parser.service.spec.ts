import { EmailParserService } from './email-parser.service';
import { gmail_v1 } from 'googleapis';

describe('EmailParserService', () => {
  let service: EmailParserService;

  beforeEach(() => {
    service = new EmailParserService();
  });

  describe('decodeBase64Url', () => {
    it('should decode base64url encoded string into UTF-8 text', () => {
      // "Hello World from BHUVI!" base64url is "SGVsbG8gV29ybGQgZnJvbSBCSFVWSSE"
      const encoded = 'SGVsbG8gV29ybGQgZnJvbSBCSFVWSSE';
      expect(service.decodeBase64Url(encoded)).toBe('Hello World from BHUVI!');
    });

    it('should handle empty or null string gracefully', () => {
      expect(service.decodeBase64Url('')).toBe('');
    });
  });

  describe('parseSender', () => {
    it('should parse sender with display name and email in brackets', () => {
      const parsed = service.parseSender('Dr. Alice Smith <alice.smith@university.edu>');
      expect(parsed.name).toBe('Dr. Alice Smith');
      expect(parsed.email).toBe('alice.smith@university.edu');
    });

    it('should parse bare email address', () => {
      const parsed = service.parseSender('billing@company.com');
      expect(parsed.name).toBeNull();
      expect(parsed.email).toBe('billing@company.com');
    });

    it('should handle empty or invalid sender', () => {
      const parsed = service.parseSender('');
      expect(parsed.email).toBe('unknown@sender.local');
    });
  });

  describe('parseEmailList', () => {
    it('should parse comma-separated recipient list', () => {
      const header = 'John <john@test.com>, jane@test.com, "Boss" <boss@test.com>';
      const list = service.parseEmailList(header);
      expect(list).toEqual(['john@test.com', 'jane@test.com', 'boss@test.com']);
    });

    it('should return empty array for empty header', () => {
      expect(service.parseEmailList(undefined)).toEqual([]);
    });
  });

  describe('htmlToPlainText', () => {
    it('should strip HTML tags and decode common entities', () => {
      const html =
        '<p>Hello <b>Team</b>,</p><br/><p>Review the &quot;Project Q3&quot; &amp; submit report.</p>';
      const text = service.htmlToPlainText(html);
      expect(text).toContain('Hello Team,');
      expect(text).toContain('Review the "Project Q3" & submit report.');
      expect(text).not.toContain('<p>');
      expect(text).not.toContain('<b>');
    });

    it('should remove script and style blocks completely', () => {
      const html =
        '<div>Visible text</div><script>alert("hack")</script><style>body { color: red; }</style>';
      const text = service.htmlToPlainText(html);
      expect(text).toBe('Visible text');
      expect(text).not.toContain('alert');
      expect(text).not.toContain('body {');
    });
  });

  describe('parseMessage', () => {
    it('should parse simple single-part message with text/plain body', () => {
      const rawText = 'Meeting is confirmed for tomorrow at 10 AM in Conference Room B.';
      const base64Data = Buffer.from(rawText, 'utf-8').toString('base64url');

      const mockMsg: gmail_v1.Schema$Message = {
        id: 'msg-12345',
        threadId: 'thread-67890',
        labelIds: ['INBOX', 'UNREAD', 'IMPORTANT'],
        snippet: 'Meeting is confirmed...',
        internalDate: '1731056400000',
        payload: {
          headers: [
            { name: 'From', value: 'Sarah Connor <sarah@resistance.org>' },
            { name: 'To', value: 'John Connor <john@resistance.org>' },
            { name: 'Subject', value: 'Strategic Planning Session' },
            { name: 'Date', value: 'Sun, 08 Nov 2026 09:00:00 +0000' },
          ],
          mimeType: 'text/plain',
          body: {
            data: base64Data,
            size: rawText.length,
          },
        },
      };

      const parsed = service.parseMessage(mockMsg);
      expect(parsed.providerMessageId).toBe('msg-12345');
      expect(parsed.providerThreadId).toBe('thread-67890');
      expect(parsed.senderName).toBe('Sarah Connor');
      expect(parsed.senderEmail).toBe('sarah@resistance.org');
      expect(parsed.recipientEmails).toEqual(['john@resistance.org']);
      expect(parsed.subject).toBe('Strategic Planning Session');
      expect(parsed.bodyText).toBe(rawText);
      expect(parsed.isRead).toBe(false); // UNREAD in labelIds
      expect(parsed.hasAttachments).toBe(false);
      expect(parsed.labels).toEqual(['INBOX', 'UNREAD', 'IMPORTANT']);
    });

    it('should traverse nested multipart message and extract text and attachments', () => {
      const bodyText = 'Please find attached invoice for services rendered.';
      const bodyBase64 = Buffer.from(bodyText, 'utf-8').toString('base64url');

      const mockMsg: gmail_v1.Schema$Message = {
        id: 'msg-multipart-1',
        threadId: 'thread-multi-1',
        labelIds: ['INBOX'],
        payload: {
          headers: [
            { name: 'From', value: 'Vendor <invoicing@vendor.com>' },
            { name: 'To', value: 'Accounts <accounts@bhuvi.local>' },
            { name: 'Subject', value: 'Invoice #99482' },
          ],
          mimeType: 'multipart/mixed',
          parts: [
            {
              mimeType: 'multipart/alternative',
              parts: [
                {
                  mimeType: 'text/plain',
                  body: { data: bodyBase64 },
                },
              ],
            },
            {
              mimeType: 'application/pdf',
              filename: '../../malicious/invoice_99482.pdf', // Path traversal attempt
              body: {
                attachmentId: 'att-pdf-111',
                size: 45000,
              },
            },
          ],
        },
      };

      const parsed = service.parseMessage(mockMsg);
      expect(parsed.bodyText).toBe(bodyText);
      expect(parsed.hasAttachments).toBe(true);
      expect(parsed.attachments).toHaveLength(1);
      const att = parsed.attachments[0]!;
      expect(att.providerAttachmentId).toBe('att-pdf-111');
      expect(att.mimeType).toBe('application/pdf');
      expect(att.size).toBe(45000);
      // Path traversal should be sanitized: slashes converted to underscore
      expect(att.filename).not.toContain('/');
      expect(att.filename).not.toContain('..');
      expect(att.filename).toContain('invoice_99482.pdf');
    });

    it('should fallback to HTML text conversion when text/plain part is missing', () => {
      const htmlBody = '<h1>Notice</h1><p>Your subscription is renewed.</p>';
      const htmlBase64 = Buffer.from(htmlBody, 'utf-8').toString('base64url');

      const mockMsg: gmail_v1.Schema$Message = {
        id: 'msg-html-only',
        payload: {
          headers: [
            { name: 'From', value: 'noreply@service.com' },
            { name: 'Subject', value: 'Renewal Notice' },
          ],
          mimeType: 'text/html',
          body: { data: htmlBase64 },
        },
      };

      const parsed = service.parseMessage(mockMsg);
      expect(parsed.bodyText).toContain('Notice');
      expect(parsed.bodyText).toContain('Your subscription is renewed.');
      expect(parsed.bodyHtml).toBe(htmlBody);
    });
  });
});
