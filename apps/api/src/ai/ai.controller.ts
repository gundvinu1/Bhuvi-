import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiResponse,
  AiStatusResponse,
  AiModelInfo,
  AiChatResponse,
  SafeUser,
  APP_VERSION,
} from '@bhuvi/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  private formatResponse<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: APP_VERSION,
      },
    };
  }

  /**
   * GET /api/v1/ai/status
   * Public telemetry endpoint returning Ollama connection status, configured model,
   * and availability indicator without leaking internal secrets.
   */
  @Get('status')
  @HttpCode(HttpStatus.OK)
  async getStatus(): Promise<ApiResponse<AiStatusResponse>> {
    const status = await this.aiService.getStatus();
    return this.formatResponse(status);
  }

  /**
   * GET /api/v1/ai/models
   * Retrieves all locally installed Ollama models available on this machine.
   */
  @Get('models')
  @HttpCode(HttpStatus.OK)
  async getModels(): Promise<ApiResponse<AiModelInfo[]>> {
    const models = await this.aiService.getModels();
    return this.formatResponse(models);
  }

  /**
   * POST /api/v1/ai/chat
   * Authenticated chat completion endpoint. Submits prompt to local Ollama model.
   * Throttled to 20 requests per minute to prevent local hardware exhaustion.
   */
  @Post('chat')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async chat(
    @Body() dto: ChatDto,
    @CurrentUser() user: SafeUser,
  ): Promise<ApiResponse<AiChatResponse>> {
    const result = await this.aiService.chat(dto, user.id);
    return this.formatResponse(result);
  }
}
