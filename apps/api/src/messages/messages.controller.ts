import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiResponse,
  MessageDto,
  MessageAnalysisDto,
  MessageAnalysisResult,
  MessageActionItemDto,
  MessageStatsDto,
  SafeUser,
  APP_VERSION,
} from '@bhuvi/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MessagesService, PaginatedMessagesResponse } from './services/messages.service';
import { MessageIntelligenceService } from './services/message-intelligence.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { AnalyzePreviewDto } from './dto/analyze-preview.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { UpdateActionItemDto } from './dto/update-action-item.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly intelligenceService: MessageIntelligenceService,
  ) {}

  private formatResponse<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: APP_VERSION,
        ...meta,
      },
    };
  }

  /**
   * POST /api/v1/messages
   * Ingest and store an incoming message with duplicate checking and optional immediate AI analysis.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async createMessage(
    @CurrentUser() user: SafeUser,
    @Body() dto: CreateMessageDto,
  ): Promise<ApiResponse<MessageDto>> {
    const message = await this.messagesService.createMessage(user.id, dto);
    return this.formatResponse(message, { isDuplicate: message.isDuplicate });
  }

  /**
   * POST /api/v1/messages/analyze-preview
   * Analyzes supplied message content on the fly without storing it in the database.
   */
  @Post('analyze-preview')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async analyzePreview(
    @Body() dto: AnalyzePreviewDto,
  ): Promise<ApiResponse<MessageAnalysisResult>> {
    const analysis = await this.intelligenceService.analyzeContent(
      dto.content,
      dto.senderName,
      dto.subject,
    );
    return this.formatResponse(analysis);
  }

  /**
   * GET /api/v1/messages/priority
   * Retrieves high-priority and urgent messages for the user.
   */
  @Get('priority')
  async getPriorityMessages(@CurrentUser() user: SafeUser): Promise<ApiResponse<MessageDto[]>> {
    const messages = await this.messagesService.getPriorityMessages(user.id);
    return this.formatResponse(messages, { count: messages.length });
  }

  /**
   * GET /api/v1/messages/actions
   * Retrieves extracted action items for the authenticated user.
   */
  @Get('actions')
  async getActionItems(
    @CurrentUser() user: SafeUser,
  ): Promise<ApiResponse<MessageActionItemDto[]>> {
    const items = await this.messagesService.getActionItems(user.id);
    return this.formatResponse(items, { count: items.length });
  }

  /**
   * PATCH /api/v1/messages/actions/:id
   * Updates an action item's lifecycle status.
   */
  @Patch('actions/:id')
  async updateActionItem(
    @CurrentUser() user: SafeUser,
    @Param('id') actionItemId: string,
    @Body() dto: UpdateActionItemDto,
  ): Promise<ApiResponse<MessageActionItemDto>> {
    const updated = await this.messagesService.updateActionItemStatus(
      actionItemId,
      user.id,
      dto.status,
    );
    return this.formatResponse(updated);
  }

  /**
   * GET /api/v1/messages/stats
   * Retrieves aggregate intelligence metrics for the user's messages.
   */
  @Get('stats')
  async getStats(@CurrentUser() user: SafeUser): Promise<ApiResponse<MessageStatsDto>> {
    const stats = await this.messagesService.getStats(user.id);
    return this.formatResponse(stats);
  }

  /**
   * GET /api/v1/messages
   * Lists paginated messages for the authenticated user with multi-faceted filtering.
   */
  @Get()
  async getMessages(
    @CurrentUser() user: SafeUser,
    @Query() query: QueryMessagesDto,
  ): Promise<ApiResponse<PaginatedMessagesResponse>> {
    const result = await this.messagesService.getMessages(user.id, query);
    return this.formatResponse(result, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  }

  /**
   * GET /api/v1/messages/:id
   * Retrieves a single message by ID, verifying user ownership.
   */
  @Get(':id')
  async getMessage(
    @CurrentUser() user: SafeUser,
    @Param('id') messageId: string,
  ): Promise<ApiResponse<MessageDto>> {
    const message = await this.messagesService.getMessageById(messageId, user.id);
    return this.formatResponse(message);
  }

  /**
   * GET /api/v1/messages/:id/analysis
   * Retrieves only the analysis metadata for a message.
   */
  @Get(':id/analysis')
  async getMessageAnalysis(
    @CurrentUser() user: SafeUser,
    @Param('id') messageId: string,
  ): Promise<ApiResponse<MessageAnalysisDto>> {
    const analysis = await this.messagesService.getMessageAnalysis(messageId, user.id);
    return this.formatResponse(analysis);
  }

  /**
   * POST /api/v1/messages/:id/analyze
   * Forces re-analysis of an existing message.
   */
  @Post(':id/analyze')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  async analyzeMessage(
    @CurrentUser() user: SafeUser,
    @Param('id') messageId: string,
  ): Promise<ApiResponse<MessageDto>> {
    const message = await this.messagesService.analyzeMessage(messageId, user.id);
    return this.formatResponse(message);
  }

  /**
   * DELETE /api/v1/messages/:id
   * Deletes a message and its associated analysis and action items.
   */
  @Delete(':id')
  async deleteMessage(
    @CurrentUser() user: SafeUser,
    @Param('id') messageId: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    const result = await this.messagesService.deleteMessage(messageId, user.id);
    return this.formatResponse(result);
  }
}
