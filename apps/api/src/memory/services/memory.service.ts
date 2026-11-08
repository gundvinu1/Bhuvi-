import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService, Prisma } from '@bhuvi/database';
import {
  MemoryDto,
  MemoryChunkDto,
  MemoryCategory,
  MemoryImportance,
  MemoryStatus,
  MemoryStatsDto,
  MemorySearchResult,
  MemoryAskResult,
  MemoryConflictResult,
} from '@bhuvi/shared';
import { createDefaultQueue, enqueueProcessMemory } from '@bhuvi/queue';
import { CreateMemoryDto } from '../dto/create-memory.dto';
import { UpdateMemoryDto } from '../dto/update-memory.dto';
import { QueryMemoryDto } from '../dto/query-memory.dto';
import { SearchMemoryDto } from '../dto/search-memory.dto';
import { AskMemoryDto } from '../dto/ask-memory.dto';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding.service';
import { VectorSearchService } from './vector-search.service';
import { RagService } from './rag.service';

export interface PaginatedMemoryResponse {
  memories: MemoryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CategoryInfo {
  key: MemoryCategory;
  label: string;
  description: string;
}

export const MEMORY_CATEGORIES_METADATA: CategoryInfo[] = [
  {
    key: 'PERSONAL',
    label: 'Personal',
    description: 'Personal preferences, habits, health, and family info',
  },
  {
    key: 'PROJECT',
    label: 'Projects',
    description: 'Technical context, architectures, roadmap, and tasks',
  },
  {
    key: 'EDUCATION',
    label: 'Education',
    description: 'Coursework, books, learning notes, and study material',
  },
  {
    key: 'WORK',
    label: 'Work',
    description: 'Job responsibilities, meetings, workflows, and employer details',
  },
  {
    key: 'BUSINESS',
    label: 'Business',
    description: 'Client details, business strategies, financial goals',
  },
  {
    key: 'IMPORTANT_EVENTS',
    label: 'Events & Milestones',
    description: 'Key dates, deadlines, birthdays, and anniversaries',
  },
  {
    key: 'NOTES',
    label: 'Quick Notes',
    description: 'Ad-hoc notes, ideas, bookmarks, and thoughts',
  },
  {
    key: 'CONVERSATION',
    label: 'Conversations',
    description: 'Summaries from past chats, meetings, and discussions',
  },
];

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chunkingService: ChunkingService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorSearch: VectorSearchService,
    private readonly ragService: RagService,
  ) {}

  /**
   * Enqueues a background job via BullMQ if Redis is reachable.
   */
  private async tryEnqueueProcessMemory(
    memoryId: string,
    userId: string,
    force = false,
  ): Promise<void> {
    try {
      const queue = createDefaultQueue();
      await enqueueProcessMemory(queue, { memoryId, userId, force });
      await queue.close();
    } catch (err: unknown) {
      this.logger.debug(
        `BullMQ enqueue skipped (Redis might be in test mode or unconfigured): ${(err as Error).message}`,
      );
    }
  }

  /**
   * Processes a memory: splits content into chunks, generates vector embeddings,
   * stores chunks into PostgreSQL, and updates memory status.
   */
  async processMemorySync(memoryId: string, userId: string): Promise<void> {
    const memory = await this.prisma.memory.findUnique({
      where: { id: memoryId },
    });

    if (!memory || memory.userId !== userId) {
      return;
    }

    try {
      // 1. Mark status as PROCESSING
      await this.prisma.memory.update({
        where: { id: memoryId },
        data: { status: 'PROCESSING', errorMessage: null },
      });

      // 2. Delete existing chunks if any
      await this.prisma.memoryChunk.deleteMany({
        where: { memoryId },
      });

      // 3. Generate text chunks
      const textChunks = this.chunkingService.chunkText(memory.content);

      if (textChunks.length === 0) {
        await this.prisma.memory.update({
          where: { id: memoryId },
          data: { status: 'COMPLETED' },
        });
        return;
      }

      // 4. Generate embeddings for each chunk
      for (const chunk of textChunks) {
        let embeddingVector: number[];
        let dimensions: number;
        let modelName: string;

        try {
          const embRes = await this.embeddingService.generateEmbedding(chunk.content);
          embeddingVector = embRes.embedding;
          dimensions = embRes.dimensions;
          modelName = embRes.model;
        } catch (embErr: unknown) {
          this.logger.warn(
            `Live embedding failed; falling back to deterministic embedding for test/offline resilience: ${(embErr as Error).message}`,
          );
          const fallback = this.embeddingService.generateDeterministicEmbedding(chunk.content);
          embeddingVector = fallback.embedding;
          dimensions = fallback.dimensions;
          modelName = fallback.model;
        }

        // Store chunk with Float[] embedding
        await this.prisma.memoryChunk.create({
          data: {
            memoryId,
            userId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            embedding: embeddingVector,
            dimensions,
            modelName,
          },
        });
      }

      // 5. Mark status as COMPLETED
      await this.prisma.memory.update({
        where: { id: memoryId },
        data: { status: 'COMPLETED', errorMessage: null },
      });

      this.logger.log(
        `Successfully processed memory [${memoryId}] with ${textChunks.length} chunks.`,
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown processing error';
      this.logger.error(`Error processing memory [${memoryId}]: ${errMsg}`);
      await this.prisma.memory.update({
        where: { id: memoryId },
        data: { status: 'FAILED', errorMessage: errMsg },
      });
    }
  }

  /**
   * Creates a new memory, links tags, checks for conflicts, and processes chunks & embeddings.
   */
  async createMemory(
    userId: string,
    dto: CreateMemoryDto,
  ): Promise<MemoryDto & { conflict?: MemoryConflictResult }> {
    const title = dto.title.trim();
    const content = dto.content.trim();
    const category = dto.category;
    const importance = dto.importance || 'MEDIUM';
    const source = dto.source?.trim() || 'USER_MANUAL';
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    // Check for potential duplicate/conflicting memory
    const conflict = await this.vectorSearch.detectConflict(userId, title, content);

    // 1. Create Memory record
    const created = await this.prisma.memory.create({
      data: {
        userId,
        title,
        content,
        category,
        importance,
        source,
        status: 'PENDING',
        expiresAt,
      },
    });

    // 2. Handle Tags
    if (dto.tags && dto.tags.length > 0) {
      for (const tagName of dto.tags) {
        const cleanName = tagName.trim().toLowerCase();
        if (cleanName) {
          const tag = await this.prisma.memoryTag.upsert({
            where: {
              userId_name: {
                userId,
                name: cleanName,
              },
            },
            create: { userId, name: cleanName },
            update: {},
          });

          await this.prisma.memoryTagAssignment.create({
            data: {
              memoryId: created.id,
              tagId: tag.id,
            },
          });
        }
      }
    }

    // 3. Process Chunks & Vector Embeddings
    await this.processMemorySync(created.id, userId);

    // 4. Try queueing background job
    await this.tryEnqueueProcessMemory(created.id, userId);

    // 5. Fetch updated entity with chunks and tags
    const result = await this.getMemoryById(userId, created.id);
    return {
      ...result,
      conflict: conflict.hasConflict ? conflict : undefined,
    };
  }

  /**
   * Retrieves paginated memories with filtering.
   */
  async getMemories(userId: string, query: QueryMemoryDto): Promise<PaginatedMemoryResponse> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.MemoryWhereInput = {
      userId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.importance ? { importance: query.importance } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: 'insensitive' } },
              { content: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.tag
        ? {
            tagAssignments: {
              some: {
                tag: {
                  name: query.tag.trim().toLowerCase(),
                },
              },
            },
          }
        : {}),
    };

    const [total, memories] = await Promise.all([
      this.prisma.memory.count({ where }),
      this.prisma.memory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tagAssignments: {
            include: { tag: true },
          },
          _count: {
            select: { chunks: true },
          },
        },
      }),
    ]);

    const items: MemoryDto[] = memories.map((m) => ({
      id: m.id,
      userId: m.userId,
      title: m.title,
      content: m.content,
      category: m.category as MemoryCategory,
      importance: m.importance as MemoryImportance,
      source: m.source,
      status: m.status as MemoryStatus,
      errorMessage: m.errorMessage,
      expiresAt: m.expiresAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      tags: m.tagAssignments.map((a) => a.tag.name),
      chunksCount: m._count.chunks,
    }));

    return {
      memories: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves single memory details. Throws NotFoundException if missing or belonging to another user.
   */
  async getMemoryById(userId: string, id: string): Promise<MemoryDto> {
    const memory = await this.prisma.memory.findUnique({
      where: { id },
      include: {
        tagAssignments: {
          include: { tag: true },
        },
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });

    if (!memory || memory.userId !== userId) {
      throw new NotFoundException(`Memory with ID "${id}" was not found.`);
    }

    const chunkDtos: MemoryChunkDto[] = memory.chunks.map((c) => ({
      id: c.id,
      memoryId: c.memoryId,
      chunkIndex: c.chunkIndex,
      content: c.content,
      tokenCount: c.tokenCount,
      dimensions: c.dimensions,
      modelName: c.modelName,
      createdAt: c.createdAt.toISOString(),
    }));

    return {
      id: memory.id,
      userId: memory.userId,
      title: memory.title,
      content: memory.content,
      category: memory.category as MemoryCategory,
      importance: memory.importance as MemoryImportance,
      source: memory.source,
      status: memory.status as MemoryStatus,
      errorMessage: memory.errorMessage,
      expiresAt: memory.expiresAt?.toISOString() ?? null,
      createdAt: memory.createdAt.toISOString(),
      updatedAt: memory.updatedAt.toISOString(),
      tags: memory.tagAssignments.map((a) => a.tag.name),
      chunks: chunkDtos,
      chunksCount: chunkDtos.length,
    };
  }

  /**
   * Updates an existing memory. If content is changed, re-chunks and re-embeds.
   */
  async updateMemory(userId: string, id: string, dto: UpdateMemoryDto): Promise<MemoryDto> {
    const existing = await this.prisma.memory.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException(`Memory with ID "${id}" was not found.`);
    }

    const contentChanged = dto.content !== undefined && dto.content.trim() !== existing.content;

    // 1. Update basic fields
    await this.prisma.memory.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.importance !== undefined ? { importance: dto.importance } : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
          : {}),
      },
    });

    // 2. Update tags if provided
    if (dto.tags !== undefined) {
      // Clear existing assignments
      await this.prisma.memoryTagAssignment.deleteMany({
        where: { memoryId: id },
      });

      // Add new tag assignments
      for (const tagName of dto.tags) {
        const clean = tagName.trim().toLowerCase();
        if (clean) {
          const tag = await this.prisma.memoryTag.upsert({
            where: {
              userId_name: {
                userId,
                name: clean,
              },
            },
            create: { userId, name: clean },
            update: {},
          });

          await this.prisma.memoryTagAssignment.create({
            data: {
              memoryId: id,
              tagId: tag.id,
            },
          });
        }
      }
    }

    // 3. Re-process chunks if content changed
    if (contentChanged) {
      await this.processMemorySync(id, userId);
      await this.tryEnqueueProcessMemory(id, userId, true);
    }

    return this.getMemoryById(userId, id);
  }

  /**
   * Deletes a memory and all related chunks, tag assignments, and access logs.
   */
  async deleteMemory(userId: string, id: string): Promise<{ deleted: boolean; id: string }> {
    const existing = await this.prisma.memory.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException(`Memory with ID "${id}" was not found.`);
    }

    await this.prisma.memory.delete({
      where: { id },
    });

    this.logger.log(`Deleted memory [${id}] for user [${userId}]`);
    return { deleted: true, id };
  }

  /**
   * Forces re-chunking and re-embedding for a memory.
   */
  async reprocessMemory(userId: string, id: string): Promise<MemoryDto> {
    const existing = await this.prisma.memory.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException(`Memory with ID "${id}" was not found.`);
    }

    await this.processMemorySync(id, userId);
    await this.tryEnqueueProcessMemory(id, userId, true);

    return this.getMemoryById(userId, id);
  }

  /**
   * Executes vector search across user memories and logs the search query.
   */
  async searchMemories(userId: string, dto: SearchMemoryDto): Promise<MemorySearchResult[]> {
    const results = await this.vectorSearch.searchByText(userId, dto.query, {
      limit: dto.limit,
      threshold: dto.threshold,
      category: dto.category,
    });

    // Record access log
    try {
      await this.prisma.memoryAccessLog.create({
        data: {
          userId,
          memoryId: results[0]?.memoryId,
          action: 'SEARCH',
          query: dto.query,
          similarity: results[0]?.similarity,
        },
      });
    } catch (logErr: unknown) {
      this.logger.warn(`Failed to log memory search: ${(logErr as Error).message}`);
    }

    return results;
  }

  /**
   * Executes RAG question answering.
   */
  async askMemory(userId: string, dto: AskMemoryDto): Promise<MemoryAskResult> {
    return this.ragService.ask(userId, dto.question, {
      limit: dto.limit,
      minSimilarity: dto.minSimilarity,
    });
  }

  /**
   * Computes comprehensive memory system metrics for a user.
   */
  async getStats(userId: string): Promise<MemoryStatsDto> {
    const [totalMemories, completedMemories, pendingMemories, failedMemories, totalChunks] =
      await Promise.all([
        this.prisma.memory.count({ where: { userId } }),
        this.prisma.memory.count({ where: { userId, status: 'COMPLETED' } }),
        this.prisma.memory.count({ where: { userId, status: { in: ['PENDING', 'PROCESSING'] } } }),
        this.prisma.memory.count({ where: { userId, status: 'FAILED' } }),
        this.prisma.memoryChunk.count({ where: { userId } }),
      ]);

    const categories: MemoryCategory[] = [
      'PERSONAL',
      'PROJECT',
      'EDUCATION',
      'WORK',
      'BUSINESS',
      'IMPORTANT_EVENTS',
      'NOTES',
      'CONVERSATION',
    ];

    const distribution: Record<MemoryCategory, number> = {
      PERSONAL: 0,
      PROJECT: 0,
      EDUCATION: 0,
      WORK: 0,
      BUSINESS: 0,
      IMPORTANT_EVENTS: 0,
      NOTES: 0,
      CONVERSATION: 0,
    };

    const categoryCounts = await this.prisma.memory.groupBy({
      by: ['category'],
      where: { userId },
      _count: { _all: true },
    });

    for (const item of categoryCounts) {
      if (categories.includes(item.category as MemoryCategory)) {
        distribution[item.category as MemoryCategory] = item._count._all;
      }
    }

    return {
      totalMemories,
      completedMemories,
      pendingMemories,
      failedMemories,
      totalChunks,
      categoryDistribution: distribution,
    };
  }

  /**
   * Returns list of supported categories and importance levels.
   */
  getCategories(): { categories: CategoryInfo[]; importances: MemoryImportance[] } {
    return {
      categories: MEMORY_CATEGORIES_METADATA,
      importances: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    };
  }
}
