import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '@bhuvi/database';
import { GmailOAuthService } from './services/gmail-oauth.service';
import { GmailSyncService } from './services/gmail-sync.service';
import { GmailAiService } from './services/gmail-ai.service';
import { GmailDraftService } from './services/gmail-draft.service';
import { MessageIntelligenceService } from '../messages/services/message-intelligence.service';
import { CreateDraftDto } from './dto/create-draft.dto';
import { QueryGmailDto } from './dto/query-gmail.dto';
import { SuggestReplyDto } from './dto/suggest-reply.dto';
import { AskEmailsDto } from './dto/ask-emails.dto';
import {
  GmailConnectionDto,
  GmailConnectionStatus,
  GmailConnectUrlResponse,
  GmailMessageDto,
  GmailSyncStatsDto,
  PaginatedGmailMessagesResponse,
  GmailSuggestedReplyDto,
  GmailDraftCreatedResult,
  GmailSummaryResponse,
} from '@bhuvi/shared';

@Controller('gmail')
export class GmailController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oauthService: GmailOAuthService,
    private readonly syncService: GmailSyncService,
    private readonly aiService: GmailAiService,
    private readonly draftService: GmailDraftService,
    private readonly messageIntelligence: MessageIntelligenceService,
  ) {}

  // ============================================================
  // OAuth & Connection Management
  // ============================================================

  @UseGuards(JwtAuthGuard)
  @Get('connection')
  async getConnection(@CurrentUser() user: { id: string }): Promise<GmailConnectionDto | null> {
    const connection = await this.prisma.gmailConnection.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      return null;
    }

    return {
      id: connection.id,
      userId: connection.userId,
      googleAccountEmail: connection.googleAccountEmail,
      googleAccountId: connection.googleAccountId,
      connectionStatus: connection.connectionStatus as GmailConnectionStatus,
      scopes: connection.scopes,
      lastSyncedAt: connection.lastSyncedAt ? connection.lastSyncedAt.toISOString() : null,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('oauth/connect')
  getConnectUrl(@CurrentUser() user: { id: string }): GmailConnectUrlResponse {
    return this.oauthService.getConnectUrl(user.id);
  }

  @Get('oauth/callback')
  async handleOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const result = await this.oauthService.handleCallback(code, state);

      // Trigger asynchronous initial sync in background
      const { userId } = this.oauthService.validateState(state);
      if (userId) {
        this.syncService.tryEnqueueSync(result.connectionId, userId).catch(() => {});
      }

      // Redirect user back to frontend dashboard
      const clientUrl = process.env['WEB_URL'] || 'http://localhost:3000';
      return res.redirect(
        `${clientUrl}/dashboard/gmail?connected=true&email=${encodeURIComponent(result.email)}`,
      );
    } catch (err: unknown) {
      const clientUrl = process.env['WEB_URL'] || 'http://localhost:3000';
      const msg = encodeURIComponent((err as Error).message || 'OAuth callback failed');
      return res.redirect(`${clientUrl}/dashboard/gmail?error=${msg}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect(@CurrentUser() user: { id: string }): Promise<{ disconnected: boolean }> {
    return this.oauthService.disconnect(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reconnect')
  @HttpCode(HttpStatus.OK)
  reconnect(@CurrentUser() user: { id: string }): GmailConnectUrlResponse {
    return this.oauthService.getConnectUrl(user.id);
  }

  // ============================================================
  // Inbox Synchronization
  // ============================================================

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncInbox(
    @CurrentUser() user: { id: string },
    @Query('max') max?: string,
  ): Promise<{ syncedCount: number; historyId?: string }> {
    const limit = max ? parseInt(max, 10) : 50;
    return this.syncService.syncInbox(user.id, undefined, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sync/status')
  async getSyncStatus(@CurrentUser() user: { id: string }): Promise<any> {
    const latest = await this.prisma.gmailSyncState.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return latest || { syncStatus: 'IDLE', syncedCount: 0 };
  }

  @UseGuards(JwtAuthGuard)
  @Get('sync/history')
  async getSyncHistory(@CurrentUser() user: { id: string }): Promise<any[]> {
    return this.prisma.gmailSyncState.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('sync/stats')
  async getSyncStats(@CurrentUser() user: { id: string }): Promise<GmailSyncStatsDto> {
    return this.syncService.getSyncStats(user.id);
  }

  // ============================================================
  // Message Listing & Details
  // ============================================================

  @UseGuards(JwtAuthGuard)
  @Get('messages')
  async getMessages(
    @CurrentUser() user: { id: string },
    @Query() query: QueryGmailDto,
  ): Promise<PaginatedGmailMessagesResponse> {
    return this.syncService.getMessages(user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages/unread')
  async getUnreadMessages(
    @CurrentUser() user: { id: string },
    @Query() query: QueryGmailDto,
  ): Promise<PaginatedGmailMessagesResponse> {
    return this.syncService.getMessages(user.id, { ...query, unreadOnly: true });
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages/important')
  async getImportantMessages(
    @CurrentUser() user: { id: string },
    @Query() query: QueryGmailDto,
  ): Promise<PaginatedGmailMessagesResponse> {
    return this.syncService.getMessages(user.id, { ...query, importantOnly: true });
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages/search')
  async searchMessages(
    @CurrentUser() user: { id: string },
    @Query() query: QueryGmailDto,
  ): Promise<PaginatedGmailMessagesResponse> {
    return this.syncService.getMessages(user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages/:id')
  async getMessageById(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<GmailMessageDto> {
    return this.syncService.getMessageById(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages/:id/thread')
  async getThread(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<GmailMessageDto[]> {
    const email = await this.syncService.getMessageById(user.id, id);
    return this.syncService.getThread(user.id, email.providerThreadId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages/:id/attachments')
  async getAttachments(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<any[]> {
    const email = await this.syncService.getMessageById(user.id, id);
    return email.attachments || [];
  }

  // ============================================================
  // AI Operations
  // ============================================================

  @UseGuards(JwtAuthGuard)
  @Post('messages/:id/summarize')
  @HttpCode(HttpStatus.OK)
  async summarizeMessage(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<GmailSummaryResponse> {
    return this.aiService.summarizeEmail(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('messages/:id/suggest-reply')
  @HttpCode(HttpStatus.OK)
  async suggestReply(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SuggestReplyDto,
  ): Promise<GmailSuggestedReplyDto> {
    return this.aiService.suggestReply(user.id, id, dto.instruction);
  }

  @UseGuards(JwtAuthGuard)
  @Post('messages/:id/analyze')
  @HttpCode(HttpStatus.OK)
  async analyzeMessage(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<any> {
    const email = await this.syncService.getMessageById(user.id, id);
    if (!email.messageId) {
      throw new NotFoundException('Linked message record not found for analysis.');
    }
    return this.messageIntelligence.analyzeAndStoreMessage(email.messageId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('messages/:id/create-draft')
  @HttpCode(HttpStatus.CREATED)
  async createDraft(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: CreateDraftDto,
  ): Promise<GmailDraftCreatedResult> {
    const email = await this.syncService.getMessageById(user.id, id);
    return this.draftService.createDraft(user.id, email.gmailConnectionId, {
      ...dto,
      threadId: dto.threadId || email.providerThreadId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('ask')
  @HttpCode(HttpStatus.OK)
  async askAboutEmails(
    @CurrentUser() user: { id: string },
    @Body() dto: AskEmailsDto,
  ): Promise<{ answer: string; references: any[] }> {
    return this.aiService.askAboutEmails(user.id, dto.question);
  }
}
