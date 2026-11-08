import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@bhuvi/database';
import { MemoryService } from './memory.service';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding.service';
import { VectorSearchService } from './vector-search.service';
import { RagService } from './rag.service';

describe('MemoryService', () => {
  let service: MemoryService;
  let prisma: Partial<PrismaService>;
  let chunkingService: Partial<ChunkingService>;
  let embeddingService: Partial<EmbeddingService>;
  let vectorSearch: Partial<VectorSearchService>;
  let ragService: Partial<RagService>;

  beforeEach(() => {
    prisma = {
      memory: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
      } as any,
      memoryChunk: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      } as any,
      memoryTag: {
        upsert: jest.fn().mockResolvedValue({ id: 'tag-1', name: 'tech' }),
      } as any,
      memoryTagAssignment: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      } as any,
      memoryAccessLog: {
        create: jest.fn(),
      } as any,
    };

    chunkingService = {
      chunkText: jest
        .fn()
        .mockReturnValue([{ chunkIndex: 0, content: 'Chunk 1 content', tokenCount: 10 }]),
    };

    embeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue({
        embedding: [0.1, 0.2, 0.3],
        dimensions: 3,
        model: 'nomic-embed-text',
      }),
      generateDeterministicEmbedding: jest.fn().mockReturnValue({
        embedding: [0.1, 0.2, 0.3],
        dimensions: 3,
        model: 'nomic-embed-text-mock',
      }),
    };

    vectorSearch = {
      detectConflict: jest.fn().mockResolvedValue({ hasConflict: false, similarity: 0.1 }),
      searchByText: jest.fn().mockResolvedValue([]),
    };

    ragService = {
      ask: jest.fn(),
    };

    service = new MemoryService(
      prisma as PrismaService,
      chunkingService as ChunkingService,
      embeddingService as EmbeddingService,
      vectorSearch as VectorSearchService,
      ragService as RagService,
    );
  });

  describe('createMemory', () => {
    it('should create memory, associate tags, and process vector chunks', async () => {
      const mockCreated = {
        id: 'mem-1',
        userId: 'user-1',
        title: 'Project Roadmap',
        content: 'Building personal AI OS with NestJS and Next.js.',
        category: 'PROJECT',
        importance: 'HIGH',
        source: 'USER_MANUAL',
        status: 'PENDING',
        errorMessage: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.memory!.create as jest.Mock).mockResolvedValue(mockCreated);
      (prisma.memory!.findUnique as jest.Mock).mockResolvedValue({
        ...mockCreated,
        tagAssignments: [{ tag: { name: 'roadmap' } }],
        chunks: [
          {
            id: 'chk-1',
            memoryId: 'mem-1',
            chunkIndex: 0,
            content: 'Building personal AI OS with NestJS and Next.js.',
            tokenCount: 10,
            dimensions: 3,
            modelName: 'nomic-embed-text',
            createdAt: new Date(),
          },
        ],
      });

      const res = await service.createMemory('user-1', {
        title: 'Project Roadmap',
        content: 'Building personal AI OS with NestJS and Next.js.',
        category: 'PROJECT',
        importance: 'HIGH',
        tags: ['roadmap'],
      });

      expect(res.id).toBe('mem-1');
      expect(res.title).toBe('Project Roadmap');
      expect(res.chunksCount).toBe(1);
      expect(chunkingService.chunkText).toHaveBeenCalled();
      expect(embeddingService.generateEmbedding).toHaveBeenCalled();
      expect(prisma.memoryChunk!.create).toHaveBeenCalled();
    });
  });

  describe('getMemoryById', () => {
    it('should return memory if found and owned by user', async () => {
      const mockMemory = {
        id: 'mem-1',
        userId: 'user-1',
        title: 'My Notes',
        content: 'Note content',
        category: 'NOTES',
        importance: 'MEDIUM',
        source: 'USER_MANUAL',
        status: 'COMPLETED',
        errorMessage: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tagAssignments: [],
        chunks: [],
      };

      (prisma.memory!.findUnique as jest.Mock).mockResolvedValue(mockMemory);

      const res = await service.getMemoryById('user-1', 'mem-1');
      expect(res.id).toBe('mem-1');
    });

    it('should throw NotFoundException if memory belongs to a different user (tenant isolation)', async () => {
      const mockMemory = {
        id: 'mem-1',
        userId: 'other-user',
        title: 'Private Note',
      };

      (prisma.memory!.findUnique as jest.Mock).mockResolvedValue(mockMemory);

      await expect(service.getMemoryById('user-1', 'mem-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMemory', () => {
    it('should update metadata and re-embed if content changed', async () => {
      const existing = {
        id: 'mem-1',
        userId: 'user-1',
        title: 'Old Title',
        content: 'Old Content',
      };

      (prisma.memory!.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          ...existing,
          content: 'Old Content',
        })
        .mockResolvedValue({
          ...existing,
          title: 'New Title',
          content: 'Updated Content',
          category: 'WORK',
          importance: 'MEDIUM',
          source: 'USER_MANUAL',
          status: 'COMPLETED',
          errorMessage: null,
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          tagAssignments: [],
          chunks: [],
        });

      const updated = await service.updateMemory('user-1', 'mem-1', {
        title: 'New Title',
        content: 'Updated Content',
      });

      expect(prisma.memory!.update).toHaveBeenCalled();
      expect(chunkingService.chunkText).toHaveBeenCalledWith('Updated Content');
      expect(updated.title).toBe('New Title');
    });
  });

  describe('deleteMemory', () => {
    it('should delete memory when user owns it', async () => {
      (prisma.memory!.findUnique as jest.Mock).mockResolvedValue({
        id: 'mem-1',
        userId: 'user-1',
      });

      const res = await service.deleteMemory('user-1', 'mem-1');
      expect(res.deleted).toBe(true);
      expect(prisma.memory!.delete).toHaveBeenCalledWith({ where: { id: 'mem-1' } });
    });
  });

  describe('getStats', () => {
    it('should aggregate memory metrics and category distributions', async () => {
      (prisma.memory!.count as jest.Mock)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8) // completed
        .mockResolvedValueOnce(1) // pending
        .mockResolvedValueOnce(1); // failed
      (prisma.memoryChunk!.count as jest.Mock).mockResolvedValueOnce(35);

      (prisma.memory!.groupBy as jest.Mock).mockResolvedValueOnce([
        { category: 'PROJECT', _count: { _all: 6 } },
        { category: 'PERSONAL', _count: { _all: 4 } },
      ]);

      const stats = await service.getStats('user-1');
      expect(stats.totalMemories).toBe(10);
      expect(stats.completedMemories).toBe(8);
      expect(stats.totalChunks).toBe(35);
      expect(stats.categoryDistribution.PROJECT).toBe(6);
      expect(stats.categoryDistribution.PERSONAL).toBe(4);
      expect(stats.categoryDistribution.WORK).toBe(0);
    });
  });
});
