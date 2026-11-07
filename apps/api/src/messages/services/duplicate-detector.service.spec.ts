import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@bhuvi/database';
import { DuplicateDetectorService } from './duplicate-detector.service';

describe('DuplicateDetectorService', () => {
  let service: DuplicateDetectorService;

  const mockPrisma = {
    message: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DuplicateDetectorService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<DuplicateDetectorService>(DuplicateDetectorService);
    jest.clearAllMocks();
  });

  it('normalizes content by trimming, converting to lowercase and stripping punctuation noise', () => {
    const raw = '  URGENT: Please Review The Q3 Report!!  \n\nContact: ceo@example.com  ';
    const normalized = service.normalizeContent(raw);

    expect(normalized).toBe('urgent please review the q3 report contact ceo@example.com');
  });

  it('computes consistent deterministic SHA-256 hashes for identical normalized text', () => {
    const text1 = 'Meeting at 3pm in room 402';
    const text2 = '  meeting at 3pm   in room 402! ';

    const hash1 = service.computeContentHash(text1);
    const hash2 = service.computeContentHash(text2);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('flags duplicate message when identical contentHash and sender exist for the user', async () => {
    const now = new Date();
    mockPrisma.message.findMany.mockResolvedValue([
      {
        id: 'msg-existing-1',
        userId: 'user-1',
        senderName: 'John Doe',
        senderIdentifier: 'john@example.com',
        contentHash: service.computeContentHash('Hello team'),
        receivedAt: now,
      },
    ]);

    const result = await service.checkDuplicate(
      'user-1',
      'Hello team',
      'John Doe',
      'john@example.com',
    );

    expect(result.isDuplicate).toBe(true);
    expect(result.originalMessageId).toBe('msg-existing-1');
    expect(result.reason).toContain('Identical message already received');
  });

  it('does not flag duplicate if sender differs even if text is identical', async () => {
    const now = new Date();
    mockPrisma.message.findMany.mockResolvedValue([
      {
        id: 'msg-existing-2',
        userId: 'user-1',
        senderName: 'Alice Smith',
        senderIdentifier: 'alice@example.com',
        contentHash: service.computeContentHash('Hello team'),
        receivedAt: now,
      },
    ]);

    const result = await service.checkDuplicate(
      'user-1',
      'Hello team',
      'Bob Johnson',
      'bob@example.com',
    );

    expect(result.isDuplicate).toBe(false);
    expect(result.originalMessageId).toBeUndefined();
  });

  it('returns isDuplicate false when no existing messages match the content hash', async () => {
    mockPrisma.message.findMany.mockResolvedValue([]);

    const result = await service.checkDuplicate(
      'user-1',
      'Unique content that was never sent before',
      'Sarah',
    );

    expect(result.isDuplicate).toBe(false);
  });
});
