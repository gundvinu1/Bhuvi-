import { Injectable } from '@nestjs/common';
import { PrismaService } from '@bhuvi/database';
import {
  MemorySearchResult,
  MemoryCategory,
  MemoryImportance,
  MemoryConflictResult,
} from '@bhuvi/shared';
import { EmbeddingService } from './embedding.service';

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  category?: MemoryCategory;
}

@Injectable()
export class VectorSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Computes the mathematical cosine similarity between two float vectors.
   * Returns a number between -1.0 and 1.0 (typically 0.0 to 1.0 for normalized embeddings).
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length === 0 || b.length === 0) {
      return 0;
    }

    const minLen = Math.min(a.length, b.length);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < minLen; i++) {
      const valA = a[i]!;
      const valB = b[i]!;
      dotProduct += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }

    if (normA <= 0 || normB <= 0) {
      return 0;
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    // Clamp to [-1, 1] to prevent floating point inaccuracies
    const clamped = Math.max(-1, Math.min(1, similarity));
    return Number(clamped.toFixed(4));
  }

  /**
   * Performs semantic vector search over a user's memory chunks.
   * STRICT MULTI-TENANT ISOLATION: Only chunks belonging to the given userId are queried.
   */
  async searchByVector(
    userId: string,
    queryEmbedding: number[],
    options?: SearchOptions,
  ): Promise<MemorySearchResult[]> {
    const limit = options?.limit ?? 5;
    const threshold = options?.threshold ?? 0.5;
    const category = options?.category;

    // Fetch user's chunks from PostgreSQL
    const chunks = await this.prisma.memoryChunk.findMany({
      where: {
        userId,
        memory: {
          status: 'COMPLETED',
          ...(category ? { category } : {}),
        },
      },
      include: {
        memory: {
          select: {
            id: true,
            title: true,
            category: true,
            importance: true,
            source: true,
            createdAt: true,
          },
        },
      },
    });

    if (!chunks || chunks.length === 0) {
      return [];
    }

    const scoredResults: MemorySearchResult[] = [];

    for (const chunk of chunks) {
      const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      if (similarity >= threshold) {
        scoredResults.push({
          memoryId: chunk.memoryId,
          chunkId: chunk.id,
          title: chunk.memory.title,
          category: chunk.memory.category as MemoryCategory,
          importance: chunk.memory.importance as MemoryImportance,
          chunkContent: chunk.content,
          similarity,
          source: chunk.memory.source,
          createdAt: chunk.memory.createdAt.toISOString(),
        });
      }
    }

    // Sort descending by similarity
    scoredResults.sort((a, b) => b.similarity - a.similarity);

    return scoredResults.slice(0, limit);
  }

  /**
   * Generates embedding for text query and searches relevant memory chunks.
   */
  async searchByText(
    userId: string,
    queryText: string,
    options?: SearchOptions,
  ): Promise<MemorySearchResult[]> {
    const { embedding } = await this.embeddingService.generateEmbedding(queryText);
    return this.searchByVector(userId, embedding, options);
  }

  /**
   * Detects whether new content is substantially identical or conflicting with existing memories.
   */
  async detectConflict(
    userId: string,
    title: string,
    content: string,
    excludeMemoryId?: string,
  ): Promise<MemoryConflictResult> {
    const sampleText = `${title}\n${content.slice(0, 500)}`;
    let embedding: number[];

    try {
      const res = await this.embeddingService.generateEmbedding(sampleText);
      embedding = res.embedding;
    } catch {
      return { hasConflict: false, similarity: 0 };
    }

    const chunks = await this.prisma.memoryChunk.findMany({
      where: {
        userId,
        memory: {
          status: 'COMPLETED',
          ...(excludeMemoryId ? { id: { not: excludeMemoryId } } : {}),
        },
      },
      include: {
        memory: {
          select: { id: true, title: true },
        },
      },
    });

    let highestSimilarity = 0;
    let conflictingMemory: { id: string; title: string } | null = null;

    for (const chunk of chunks) {
      const sim = this.cosineSimilarity(embedding, chunk.embedding);
      if (sim > highestSimilarity) {
        highestSimilarity = sim;
        conflictingMemory = chunk.memory;
      }
    }

    const conflictThreshold = 0.88;
    if (highestSimilarity >= conflictThreshold && conflictingMemory) {
      return {
        hasConflict: true,
        conflictingMemoryId: conflictingMemory.id,
        conflictingMemoryTitle: conflictingMemory.title,
        similarity: highestSimilarity,
        explanation: `Potential duplicate or highly related memory found: "${conflictingMemory.title}" (${(highestSimilarity * 100).toFixed(1)}% similarity).`,
      };
    }

    return {
      hasConflict: false,
      similarity: highestSimilarity,
    };
  }
}
