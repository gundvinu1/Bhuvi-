import { MemoryController } from './memory.controller';
import { MemoryService } from './services/memory.service';
import { SafeUser } from '@bhuvi/shared';

describe('MemoryController', () => {
  let controller: MemoryController;
  let service: Partial<MemoryService>;

  const mockUser: SafeUser = {
    id: 'user-uuid-1',
    email: 'vinayak@bhuvi.local',
    name: 'Vinayak',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    service = {
      createMemory: jest.fn(),
      getStats: jest.fn(),
      getCategories: jest.fn().mockReturnValue({ categories: [], importances: [] }),
      searchMemories: jest.fn(),
      askMemory: jest.fn(),
      getMemories: jest.fn(),
      getMemoryById: jest.fn(),
      updateMemory: jest.fn(),
      deleteMemory: jest.fn(),
      reprocessMemory: jest.fn(),
    };

    controller = new MemoryController(service as MemoryService);
  });

  it('should create memory with formatted ApiResponse', async () => {
    const mockMemory = {
      id: 'mem-1',
      userId: mockUser.id,
      title: 'Setup Notes',
      content: 'Config notes',
      category: 'PROJECT' as const,
      importance: 'HIGH' as const,
      source: 'USER_MANUAL',
      status: 'COMPLETED' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (service.createMemory as jest.Mock).mockResolvedValue(mockMemory);

    const res = await controller.createMemory(mockUser, {
      title: 'Setup Notes',
      content: 'Config notes',
      category: 'PROJECT',
    });

    expect(res.success).toBe(true);
    expect(res.data.id).toBe('mem-1');
    expect(res.meta?.version).toBeDefined();
    expect(service.createMemory).toHaveBeenCalledWith(mockUser.id, expect.any(Object));
  });

  it('should return stats for user', async () => {
    const mockStats = {
      totalMemories: 5,
      completedMemories: 5,
      pendingMemories: 0,
      failedMemories: 0,
      totalChunks: 12,
      categoryDistribution: {} as any,
    };

    (service.getStats as jest.Mock).mockResolvedValue(mockStats);

    const res = await controller.getStats(mockUser);
    expect(res.success).toBe(true);
    expect(res.data.totalMemories).toBe(5);
  });

  it('should search memories and format count', async () => {
    const mockResults = [
      {
        memoryId: 'mem-1',
        chunkId: 'chk-1',
        title: 'Title',
        category: 'NOTES' as const,
        importance: 'LOW' as const,
        chunkContent: 'Content',
        similarity: 0.85,
        source: 'USER_MANUAL',
        createdAt: new Date().toISOString(),
      },
    ];

    (service.searchMemories as jest.Mock).mockResolvedValue(mockResults);

    const res = await controller.searchMemories(mockUser, { query: 'Content' });
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.meta?.['count']).toBe(1);
  });

  it('should execute RAG question answering', async () => {
    const mockAskResult = {
      question: 'What is my plan?',
      answer: 'Your plan is to launch BHUVI.',
      sources: [],
      confidence: 0.9,
      foundRelevantMemory: true,
      durationMs: 120,
    };

    (service.askMemory as jest.Mock).mockResolvedValue(mockAskResult);

    const res = await controller.askMemory(mockUser, { question: 'What is my plan?' });
    expect(res.success).toBe(true);
    expect(res.data.answer).toBe('Your plan is to launch BHUVI.');
  });
});
