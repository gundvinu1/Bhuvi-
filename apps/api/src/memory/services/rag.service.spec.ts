import { PrismaService } from '@bhuvi/database';
import { RagService } from './rag.service';
import { VectorSearchService } from './vector-search.service';
import { OllamaProvider } from '../../ai/ollama.provider';
import { SecretDetectorService } from './secret-detector.service';

describe('RagService', () => {
  let service: RagService;
  let prisma: Partial<PrismaService>;
  let vectorSearch: Partial<VectorSearchService>;
  let ollamaProvider: Partial<OllamaProvider>;
  let secretDetector: SecretDetectorService;

  beforeEach(() => {
    prisma = {
      memoryAccessLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      } as any,
    };

    vectorSearch = {
      searchByText: jest.fn(),
    };

    ollamaProvider = {
      chat: jest.fn(),
    };

    secretDetector = new SecretDetectorService();

    service = new RagService(
      prisma as PrismaService,
      vectorSearch as VectorSearchService,
      ollamaProvider as OllamaProvider,
      secretDetector,
    );
  });

  it('should return honest fallback when no relevant memories are found', async () => {
    (vectorSearch.searchByText as jest.Mock).mockResolvedValue([]);

    const result = await service.ask('user-1', 'What is my passport number?');

    expect(result.foundRelevantMemory).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.sources).toEqual([]);
    expect(result.answer).toContain('I do not have any recorded memories');
    expect(ollamaProvider.chat).not.toHaveBeenCalled();
  });

  it('should generate grounded answer and source citations when relevant memories exist', async () => {
    const mockSearchResults = [
      {
        memoryId: 'mem-101',
        chunkId: 'chk-1',
        title: 'Passport and Visa Documents',
        category: 'PERSONAL',
        importance: 'HIGH',
        chunkContent: 'My passport number is Z1234567 issued in 2024.',
        similarity: 0.92,
        source: 'USER_MANUAL',
        createdAt: new Date().toISOString(),
      },
    ];

    (vectorSearch.searchByText as jest.Mock).mockResolvedValue(mockSearchResults);
    (ollamaProvider.chat as jest.Mock).mockResolvedValue({
      content: 'According to your notes, your passport number is Z1234567.',
      model: 'qwen2.5:3b',
      durationMs: 450,
    });

    const result = await service.ask('user-1', 'What is my passport number?');

    expect(result.foundRelevantMemory).toBe(true);
    expect(result.confidence).toBe(0.92);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]!.title).toBe('Passport and Visa Documents');
    expect(result.sources[0]!.relevanceScore).toBe(0.92);
    expect(result.answer).toBe('According to your notes, your passport number is Z1234567.');

    expect(prisma.memoryAccessLog!.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          memoryId: 'mem-101',
          action: 'ASK',
          query: 'What is my passport number?',
        }),
      }),
    );
  });
});
