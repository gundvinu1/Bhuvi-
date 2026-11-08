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
  MemoryDto,
  MemoryStatsDto,
  MemorySearchResult,
  MemoryAskResult,
  MemoryConflictResult,
  SafeUser,
  APP_VERSION,
} from '@bhuvi/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MemoryService, PaginatedMemoryResponse, CategoryInfo } from './services/memory.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { QueryMemoryDto } from './dto/query-memory.dto';
import { SearchMemoryDto } from './dto/search-memory.dto';
import { AskMemoryDto } from './dto/ask-memory.dto';

@Controller('memory')
@UseGuards(JwtAuthGuard)
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

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
   * POST /api/v1/memory
   * Creates a new personal memory, generates embeddings, and indexes chunks.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async createMemory(
    @CurrentUser() user: SafeUser,
    @Body() dto: CreateMemoryDto,
  ): Promise<ApiResponse<MemoryDto & { conflict?: MemoryConflictResult }>> {
    const memory = await this.memoryService.createMemory(user.id, dto);
    return this.formatResponse(memory);
  }

  /**
   * GET /api/v1/memory/stats
   * Retrieves memory counts and category distribution for the authenticated user.
   */
  @Get('stats')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getStats(@CurrentUser() user: SafeUser): Promise<ApiResponse<MemoryStatsDto>> {
    const stats = await this.memoryService.getStats(user.id);
    return this.formatResponse(stats);
  }

  /**
   * GET /api/v1/memory/categories
   * Returns metadata and definitions for supported memory categories and importance levels.
   */
  @Get('categories')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  getCategories(): ApiResponse<{ categories: CategoryInfo[]; importances: string[] }> {
    const meta = this.memoryService.getCategories();
    return this.formatResponse(meta);
  }

  /**
   * POST /api/v1/memory/search
   * Performs semantic vector search over the authenticated user's indexed memory chunks.
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async searchMemories(
    @CurrentUser() user: SafeUser,
    @Body() dto: SearchMemoryDto,
  ): Promise<ApiResponse<MemorySearchResult[]>> {
    const results = await this.memoryService.searchMemories(user.id, dto);
    return this.formatResponse(results, { count: results.length });
  }

  /**
   * POST /api/v1/memory/ask
   * Executes RAG (Retrieval-Augmented Generation) grounded on the user's personal memories.
   */
  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async askMemory(
    @CurrentUser() user: SafeUser,
    @Body() dto: AskMemoryDto,
  ): Promise<ApiResponse<MemoryAskResult>> {
    const result = await this.memoryService.askMemory(user.id, dto);
    return this.formatResponse(result, { durationMs: result.durationMs });
  }

  /**
   * GET /api/v1/memory
   * Retrieves paginated list of user memories with optional filtering.
   */
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getMemories(
    @CurrentUser() user: SafeUser,
    @Query() query: QueryMemoryDto,
  ): Promise<ApiResponse<PaginatedMemoryResponse>> {
    const result = await this.memoryService.getMemories(user.id, query);
    return this.formatResponse(result, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  }

  /**
   * GET /api/v1/memory/:id
   * Retrieves full details, chunks, and tags for a specific memory.
   */
  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getMemoryById(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
  ): Promise<ApiResponse<MemoryDto>> {
    const memory = await this.memoryService.getMemoryById(user.id, id);
    return this.formatResponse(memory);
  }

  /**
   * PATCH /api/v1/memory/:id
   * Updates an existing memory. Content modifications trigger re-chunking and re-embedding.
   */
  @Patch(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async updateMemory(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: UpdateMemoryDto,
  ): Promise<ApiResponse<MemoryDto>> {
    const updated = await this.memoryService.updateMemory(user.id, id, dto);
    return this.formatResponse(updated);
  }

  /**
   * DELETE /api/v1/memory/:id
   * Permanently deletes a memory and its associated chunks, tags, and access logs.
   */
  @Delete(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async deleteMemory(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ deleted: boolean; id: string }>> {
    const result = await this.memoryService.deleteMemory(user.id, id);
    return this.formatResponse(result);
  }

  /**
   * POST /api/v1/memory/:id/reprocess
   * Forces re-chunking and re-embedding generation for a memory.
   */
  @Post(':id/reprocess')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  async reprocessMemory(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
  ): Promise<ApiResponse<MemoryDto>> {
    const reprocessed = await this.memoryService.reprocessMemory(user.id, id);
    return this.formatResponse(reprocessed);
  }
}
