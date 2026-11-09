import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WhatsAppConnectionService } from './services/whatsapp-connection.service';
import { WhatsAppWebhookService } from './services/whatsapp-webhook.service';
import { WhatsAppConversationService } from './services/whatsapp-conversation.service';
import { WhatsAppDraftService } from './services/whatsapp-draft.service';
import { WhatsAppAiService } from './services/whatsapp-ai.service';
import { ConnectWhatsAppDto } from './dto/create-connection.dto';
import { CreateDraftDto } from './dto/create-draft.dto';
import { QueryWhatsAppDto } from './dto/query-whatsapp.dto';
import { SuggestReplyDto, AskWhatsAppDto } from './dto/whatsapp-ai.dto';
import {
  WhatsAppConnectionDto,
  WhatsAppConversationDto,
  WhatsAppMessageDto,
  WhatsAppDraftDto,
  WhatsAppSummaryDto,
  WhatsAppReplySuggestionDto,
  WhatsAppAskResponseDto,
  WhatsAppStatsDto,
  WhatsAppDraftApprovalStatus,
  MetaWebhookPayload,
} from '@bhuvi/shared';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly connectionService: WhatsAppConnectionService,
    private readonly webhookService: WhatsAppWebhookService,
    private readonly conversationService: WhatsAppConversationService,
    private readonly draftService: WhatsAppDraftService,
    private readonly aiService: WhatsAppAiService,
  ) {}

  // ============================================================
  // Webhook Endpoints (Public - Meta Verification & Events)
  // ============================================================

  /**
   * Meta Webhook Verification Challenge (GET /api/v1/whatsapp/webhook)
   */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
    @Res() res?: Response,
  ) {
    const verifiedChallenge = this.webhookService.verifyWebhookChallenge(mode, token, challenge);
    if (res) {
      return res.status(HttpStatus.OK).send(verifiedChallenge);
    }
    return verifiedChallenge;
  }

  /**
   * Meta Webhook Ingestion (POST /api/v1/whatsapp/webhook)
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: MetaWebhookPayload,
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: Request,
  ) {
    const rawBody = (req as any).rawBody || JSON.stringify(payload);
    return this.webhookService.handleIncomingWebhook(payload, rawBody, signature);
  }

  // ============================================================
  // Connection Management (Authenticated)
  // ============================================================

  @UseGuards(JwtAuthGuard)
  @Get('connections')
  async getConnections(@CurrentUser('id') userId: string): Promise<WhatsAppConnectionDto[]> {
    return this.connectionService.getConnections(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('connections/:id')
  async getConnection(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<WhatsAppConnectionDto> {
    return this.connectionService.getConnection(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('connections')
  async createConnection(
    @CurrentUser('id') userId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: ConnectWhatsAppDto,
  ): Promise<WhatsAppConnectionDto> {
    return this.connectionService.createConnection(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('connections/:id/disconnect')
  async disconnectConnection(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<{ disconnected: boolean; connectionId: string }> {
    return this.connectionService.disconnectConnection(userId, id);
  }

  // ============================================================
  // Conversations (Authenticated)
  // ============================================================

  @UseGuards(JwtAuthGuard)
  @Get('conversations')
  async getConversations(
    @CurrentUser('id') userId: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: QueryWhatsAppDto,
  ): Promise<{ items: WhatsAppConversationDto[]; total: number; page: number; limit: number }> {
    return this.conversationService.getConversations(userId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations/:id')
  async getConversation(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<WhatsAppConversationDto> {
    return this.conversationService.getConversation(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations/:id/messages')
  async getConversationMessages(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{ items: WhatsAppMessageDto[]; total: number; page: number; limit: number }> {
    return this.conversationService.getConversationMessages(
      userId,
      id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }

  // ============================================================
  // Messages (Authenticated)
  // ============================================================

  @UseGuards(JwtAuthGuard)
  @Get('messages')
  async getMessages(
    @CurrentUser('id') userId: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: QueryWhatsAppDto,
  ): Promise<{ items: WhatsAppMessageDto[]; total: number; page: number; limit: number }> {
    return this.conversationService.getMessages(userId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages/:id')
  async getMessage(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<WhatsAppMessageDto> {
    return this.conversationService.getMessage(userId, id);
  }

  // ============================================================
  // AI Operations (Authenticated)
  // ============================================================

  @UseGuards(JwtAuthGuard)
  @Post('conversations/:id/summarize')
  async summarizeConversation(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<WhatsAppSummaryDto> {
    return this.aiService.summarizeConversation(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('conversations/:id/suggest-reply')
  async suggestReply(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: SuggestReplyDto,
  ): Promise<WhatsAppReplySuggestionDto> {
    return this.aiService.suggestReply(userId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('ask')
  async askWhatsApp(
    @CurrentUser('id') userId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: AskWhatsAppDto,
  ): Promise<WhatsAppAskResponseDto> {
    return this.aiService.askWhatsApp(userId, dto);
  }

  // ============================================================
  // Drafts & Outbound Human Approval (Authenticated)
  // ============================================================

  @UseGuards(JwtAuthGuard)
  @Post('drafts')
  async createDraft(
    @CurrentUser('id') userId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: CreateDraftDto,
  ): Promise<WhatsAppDraftDto> {
    return this.draftService.createDraft(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('drafts')
  async getDrafts(
    @CurrentUser('id') userId: string,
    @Query('connectionId') connectionId?: string,
    @Query('status') status?: WhatsAppDraftApprovalStatus,
  ): Promise<WhatsAppDraftDto[]> {
    return this.draftService.getDrafts(userId, connectionId, status);
  }

  @UseGuards(JwtAuthGuard)
  @Post('drafts/:id/approve')
  async approveDraft(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<WhatsAppDraftDto> {
    return this.draftService.approveDraft(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('drafts/:id/send')
  async sendDraft(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<{ status: string; draftId: string; externalMessageId: string }> {
    return this.draftService.sendDraft(userId, id);
  }

  // ============================================================
  // Dashboard Statistics (Authenticated)
  // ============================================================

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getStats(@CurrentUser('id') userId: string): Promise<WhatsAppStatsDto> {
    return this.conversationService.getStats(userId);
  }
}
