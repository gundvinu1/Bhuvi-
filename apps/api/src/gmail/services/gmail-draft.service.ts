import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '@bhuvi/database';
import { GmailOAuthService } from './gmail-oauth.service';
import { GmailCreateDraftDto, GmailDraftCreatedResult } from '@bhuvi/shared';

@Injectable()
export class GmailDraftService {
  private readonly logger = new Logger(GmailDraftService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauthService: GmailOAuthService,
  ) {}

  /**
   * Constructs an RFC 2822 formatted raw MIME message string and base64url encodes it.
   */
  createRawMime(to: string, subject: string, bodyText: string, threadId?: string): string {
    const cleanTo = to.trim();
    const cleanSubject = subject.trim();
    const cleanBody = bodyText.trim();

    const headers = [
      `To: ${cleanTo}`,
      `Subject: =?utf-8?B?${Buffer.from(cleanSubject, 'utf-8').toString('base64')}?=`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
    ];

    if (threadId) {
      headers.push(`In-Reply-To: ${threadId}`);
      headers.push(`References: ${threadId}`);
    }

    const mimeString = `${headers.join('\r\n')}\r\n\r\n${cleanBody}`;

    return Buffer.from(mimeString, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Saves a user-approved reply draft directly to the user's Gmail account.
   * NOTE: Does NOT send the email. This uses the compose scope strictly to create a draft.
   */
  async createDraft(
    userId: string,
    connectionId: string,
    dto: GmailCreateDraftDto,
  ): Promise<GmailDraftCreatedResult> {
    if (!dto.to || !dto.to.includes('@')) {
      throw new BadRequestException('A valid recipient email address is required.');
    }

    if (!dto.body || !dto.body.trim()) {
      throw new BadRequestException('Draft body cannot be empty.');
    }

    // Verify user ownership of connection
    const connection = await this.prisma.gmailConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.userId !== userId) {
      throw new NotFoundException('Gmail connection not found or unauthorized.');
    }

    const auth = await this.oauthService.getAuthenticatedClient(connectionId, userId);
    const gmail = google.gmail({ version: 'v1', auth });

    const raw = this.createRawMime(dto.to, dto.subject, dto.body, dto.threadId);

    try {
      this.logger.log(
        `Creating Gmail draft for user [${userId}] to [${dto.to}] on thread [${dto.threadId || 'new'}]`,
      );

      const res = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw,
            threadId: dto.threadId || undefined,
          },
        },
      });

      const draftId = res.data.id;
      if (!draftId) {
        throw new Error('Google did not return a draft ID.');
      }

      this.logger.log(`Draft created successfully with ID [${draftId}]`);

      return {
        draftId,
        messageId: res.data.message?.id || undefined,
        threadId: res.data.message?.threadId || dto.threadId || undefined,
        to: dto.to,
        subject: dto.subject,
      };
    } catch (err: unknown) {
      this.logger.error(`Failed to create Gmail draft: ${(err as Error).message}`);
      throw new InternalServerErrorException(
        `Failed to create draft in Gmail: ${(err as Error).message}`,
      );
    }
  }
}
