import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@bhuvi/database';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  originalMessageId?: string;
  reason?: string;
}

@Injectable()
export class DuplicateDetectorService {
  private readonly logger = new Logger(DuplicateDetectorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalizes content by trimming, converting to lowercase, collapsing whitespace,
   * and stripping non-alphanumeric noise while retaining essential characters.
   */
  normalizeContent(content: string): string {
    return content
      .toLowerCase()
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/[^\w\s@.-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generates a deterministic SHA-256 hash for normalized message content.
   */
  computeContentHash(content: string): string {
    const normalized = this.normalizeContent(content);
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Checks if a message submitted by a user is an identical or near-identical duplicate
   * of an existing message within the user's repository.
   *
   * Strategy:
   * 1. Scope strictly to the authenticated userId.
   * 2. Compare contentHash against existing messages.
   * 3. If exact hash matches and senderName matches, flag as duplicate.
   * 4. Does not merge messages across different users or different senders.
   */
  async checkDuplicate(
    userId: string,
    content: string,
    senderName: string,
    senderIdentifier?: string,
  ): Promise<DuplicateCheckResult> {
    const contentHash = this.computeContentHash(content);

    // Look for matching content hash within the user's messages
    const candidates = await this.prisma.message.findMany({
      where: {
        userId,
        contentHash,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (candidates.length === 0) {
      return { isDuplicate: false };
    }

    // Check sender match among candidates
    const exactMatch = candidates.find((msg) => {
      const senderMatches = msg.senderName.trim().toLowerCase() === senderName.trim().toLowerCase();
      const identifierMatches =
        !senderIdentifier ||
        !msg.senderIdentifier ||
        msg.senderIdentifier.trim().toLowerCase() === senderIdentifier.trim().toLowerCase();
      return senderMatches && identifierMatches;
    });

    if (exactMatch) {
      this.logger.log(
        `Duplicate detected for user ${userId}: matches existing message ${exactMatch.id}`,
      );
      return {
        isDuplicate: true,
        originalMessageId: exactMatch.id,
        reason: `Identical message already received from ${senderName} on ${exactMatch.receivedAt.toISOString()}`,
      };
    }

    return { isDuplicate: false };
  }
}
