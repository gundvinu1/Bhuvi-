import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@bhuvi/database';
import { MemoryAskResult, MemorySourceReference } from '@bhuvi/shared';
import { OllamaProvider } from '../../ai/ollama.provider';
import { VectorSearchService } from './vector-search.service';

export interface RagOptions {
  limit?: number;
  minSimilarity?: number;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorSearch: VectorSearchService,
    private readonly ollamaProvider: OllamaProvider,
  ) {}

  /**
   * Generates a grounded RAG response to a user's question based strictly on their personal memories.
   */
  async ask(userId: string, question: string, options?: RagOptions): Promise<MemoryAskResult> {
    const startTime = Date.now();
    const limit = options?.limit ?? 4;
    const minSimilarity = options?.minSimilarity ?? 0.45;

    this.logger.log(`Executing RAG query for user [${userId}]: "${question.slice(0, 80)}"`);

    // 1. Retrieve top matching chunks
    const searchResults = await this.vectorSearch.searchByText(userId, question, {
      limit,
      threshold: minSimilarity,
    });

    // 2. If no matching memories meet threshold, return graceful grounded response
    if (searchResults.length === 0) {
      const durationMs = Date.now() - startTime;
      return {
        question,
        answer:
          'I do not have any recorded memories or knowledge about this in your personal knowledge base yet. You can add new memories in your Memory & Knowledge dashboard so I can recall them for you in the future.',
        sources: [],
        confidence: 0,
        foundRelevantMemory: false,
        durationMs,
      };
    }

    // 3. Build deduplicated sources
    const sourcesMap = new Map<string, MemorySourceReference>();
    for (const res of searchResults) {
      if (!sourcesMap.has(res.memoryId)) {
        sourcesMap.set(res.memoryId, {
          memoryId: res.memoryId,
          title: res.title,
          category: res.category,
          relevanceScore: res.similarity,
          snippet:
            res.chunkContent.length > 180
              ? `${res.chunkContent.slice(0, 180).trim()}…`
              : res.chunkContent.trim(),
        });
      }
    }
    const sources = Array.from(sourcesMap.values());
    const topConfidence = searchResults[0]?.similarity ?? 0;

    // 4. Construct context prompt
    const contextBlocks = searchResults
      .map(
        (chunk, idx) =>
          `[Memory #${idx + 1}: "${chunk.title}" | Category: ${chunk.category} | Relevance: ${(chunk.similarity * 100).toFixed(1)}%]\n${chunk.chunkContent}`,
      )
      .join('\n\n---\n\n');

    const systemPrompt = `You are BHUVI (Brain for Human Virtual Intelligence), the user's personal AI operating system.
Your role in this task is to answer the user's question accurately and honestly, based strictly on the retrieved personal memories and knowledge provided below.

<retrieved_memory_context>
${contextBlocks}
</retrieved_memory_context>

Strict Guidelines:
1. Ground your answer completely in the personal memories provided above.
2. Never invent or assume facts that are not explicitly documented in the retrieved memories.
3. If the retrieved memories only partially cover the question, state what is recorded and note what details are not found.
4. Reference the memory titles naturally (e.g. "According to your note '...', ...").
5. Keep your tone professional, concise, personal, and helpful.`;

    // 5. Query Ollama model
    let answerText: string;
    try {
      const chatResponse = await this.ollamaProvider.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ]);
      answerText = chatResponse.content?.trim() || '';
    } catch (err: unknown) {
      this.logger.error(`Ollama chat failed during RAG generation: ${(err as Error).message}`);
      answerText = `I found relevant memories regarding your question: ${sources.map((s) => `"${s.title}"`).join(', ')}, but encountered an error contacting the local generation model to formulate the summary. Details: ${(err as Error).message}`;
    }

    const durationMs = Date.now() - startTime;

    // 6. Asynchronously record access log in PostgreSQL
    try {
      await this.prisma.memoryAccessLog.create({
        data: {
          userId,
          memoryId: searchResults[0]?.memoryId,
          action: 'ASK',
          query: question,
          similarity: topConfidence,
        },
      });
    } catch (logErr: unknown) {
      this.logger.warn(`Failed to write memory access log: ${(logErr as Error).message}`);
    }

    return {
      question,
      answer: answerText,
      sources,
      confidence: topConfidence,
      foundRelevantMemory: true,
      durationMs,
    };
  }
}
