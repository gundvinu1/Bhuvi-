import { PrismaService } from '@bhuvi/database';
import { VectorSearchService } from './vector-search.service';
import { EmbeddingService } from './embedding.service';

describe('VectorSearchService', () => {
  let service: VectorSearchService;
  let prisma: Partial<PrismaService>;
  let embeddingService: Partial<EmbeddingService>;

  beforeEach(() => {
    prisma = {
      memoryChunk: {
        findMany: jest.fn(),
      } as any,
    };

    embeddingService = {
      generateEmbedding: jest.fn(),
    };

    service = new VectorSearchService(
      prisma as PrismaService,
      embeddingService as EmbeddingService,
    );
  });

  describe('cosineSimilarity', () => {
    it('should return 1.0 for identical vectors', () => {
      const v = [0.5, 0.5, 0.5, 0.5];
      expect(service.cosineSimilarity(v, v)).toBe(1.0);
    });

    it('should return 0.0 for orthogonal vectors', () => {
      const v1 = [1, 0];
      const v2 = [0, 1];
      expect(service.cosineSimilarity(v1, v2)).toBe(0.0);
    });

    it('should return -1.0 for opposite vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [-1, 0, 0];
      expect(service.cosineSimilarity(v1, v2)).toBe(-1.0);
    });

    it('should return 0 for empty or zero-magnitude vectors', () => {
      expect(service.cosineSimilarity([], [])).toBe(0);
      expect(service.cosineSimilarity([0, 0], [1, 1])).toBe(0);
    });
  });

  describe('searchByVector', () => {
    it('should search chunks strictly scoped to the userId', async () => {
      const queryVec = [1, 0, 0];
      const mockChunks = [
        {
          id: 'chunk-1',
          memoryId: 'mem-1',
          userId: 'user-1',
          content: 'Relevant memory content',
          embedding: [0.95, 0.05, 0],
          memory: {
            id: 'mem-1',
            title: 'Memory 1',
            category: 'PERSONAL',
            importance: 'HIGH',
            source: 'USER_MANUAL',
            createdAt: new Date('2026-01-01'),
          },
        },
        {
          id: 'chunk-2',
          memoryId: 'mem-2',
          userId: 'user-1',
          content: 'Irrelevant memory content',
          embedding: [0.1, 0.9, 0],
          memory: {
            id: 'mem-2',
            title: 'Memory 2',
            category: 'WORK',
            importance: 'LOW',
            source: 'USER_MANUAL',
            createdAt: new Date('2026-01-02'),
          },
        },
      ];

      (prisma.memoryChunk!.findMany as jest.Mock).mockResolvedValue(mockChunks);

      const results = await service.searchByVector('user-1', queryVec, {
        threshold: 0.5,
        limit: 5,
      });

      expect(prisma.memoryChunk!.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
          }),
        }),
      );

      expect(results).toHaveLength(1);
      expect(results[0]!.memoryId).toBe('mem-1');
      expect(results[0]!.similarity).toBeGreaterThanOrEqual(0.9);
    });

    it('should apply category filter when specified', async () => {
      (prisma.memoryChunk!.findMany as jest.Mock).mockResolvedValue([]);

      await service.searchByVector('user-1', [1, 0, 0], {
        category: 'WORK',
      });

      expect(prisma.memoryChunk!.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            memory: expect.objectContaining({
              status: 'COMPLETED',
              category: 'WORK',
            }),
          }),
        }),
      );
    });
  });

  describe('detectConflict', () => {
    it('should return conflict if an existing memory has high cosine similarity', async () => {
      (embeddingService.generateEmbedding as jest.Mock).mockResolvedValue({
        embedding: [0.99, 0.01, 0],
      });

      (prisma.memoryChunk!.findMany as jest.Mock).mockResolvedValue([
        {
          embedding: [1, 0, 0],
          memory: {
            id: 'mem-existing',
            title: 'My WiFi Password and Setup',
          },
        },
      ]);

      const result = await service.detectConflict(
        'user-1',
        'Home WiFi Password',
        'Password is secret123 on router',
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflictingMemoryId).toBe('mem-existing');
      expect(result.conflictingMemoryTitle).toBe('My WiFi Password and Setup');
      expect(result.similarity).toBeGreaterThanOrEqual(0.88);
    });

    it('should return no conflict when similarity is low', async () => {
      (embeddingService.generateEmbedding as jest.Mock).mockResolvedValue({
        embedding: [0, 1, 0],
      });

      (prisma.memoryChunk!.findMany as jest.Mock).mockResolvedValue([
        {
          embedding: [1, 0, 0],
          memory: {
            id: 'mem-existing',
            title: 'Dentist Appointment',
          },
        },
      ]);

      const result = await service.detectConflict('user-1', 'Project Architecture', 'NestJS API');
      expect(result.hasConflict).toBe(false);
    });
  });
});
