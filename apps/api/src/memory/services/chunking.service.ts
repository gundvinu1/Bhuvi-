import { Injectable } from '@nestjs/common';

export interface TextChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

@Injectable()
export class ChunkingService {
  private readonly defaultChunkSize = 500;
  private readonly defaultChunkOverlap = 60;

  /**
   * Splits a long text into overlapping chunks, respecting sentence and paragraph boundaries.
   */
  chunkText(text: string, options?: ChunkingOptions): TextChunk[] {
    const raw = text?.trim();
    if (!raw) {
      return [];
    }

    const chunkSize = Math.max(100, options?.chunkSize ?? this.defaultChunkSize);
    const chunkOverlap = Math.min(
      Math.floor(chunkSize / 2),
      Math.max(0, options?.chunkOverlap ?? this.defaultChunkOverlap),
    );

    // If text is shorter than or equal to chunkSize, return a single chunk
    if (raw.length <= chunkSize) {
      return [
        {
          chunkIndex: 0,
          content: raw,
          tokenCount: this.estimateTokens(raw),
        },
      ];
    }

    // Split text into coherent paragraphs or segments
    const paragraphs = raw
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if ((currentChunk + '\n\n' + paragraph).trim().length <= chunkSize) {
        currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
      } else {
        // If current paragraph alone fits in chunkSize
        if (paragraph.length <= chunkSize) {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
            // Overlap from the end of currentChunk
            const overlapText = this.extractOverlap(currentChunk, chunkOverlap);
            currentChunk = overlapText ? `${overlapText}\n\n${paragraph}` : paragraph;
          } else {
            currentChunk = paragraph;
          }
        } else {
          // Paragraph exceeds chunkSize; split by sentences
          const sentences = this.splitIntoSentences(paragraph);
          for (const sentence of sentences) {
            if ((currentChunk + ' ' + sentence).trim().length <= chunkSize) {
              currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
            } else {
              if (currentChunk) {
                chunks.push(currentChunk.trim());
                const overlapText = this.extractOverlap(currentChunk, chunkOverlap);
                currentChunk = overlapText ? `${overlapText} ${sentence}` : sentence;
              } else {
                // Single sentence exceeds chunkSize: hard chunk with boundary preservation
                const subChunks = this.hardSplitWords(sentence, chunkSize, chunkOverlap);
                for (let i = 0; i < subChunks.length - 1; i++) {
                  chunks.push(subChunks[i]);
                }
                currentChunk = subChunks[subChunks.length - 1] ?? '';
              }
            }
          }
        }
      }
    }

    if (currentChunk && currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    // Filter out duplicates and empty chunks
    const cleanedChunks = chunks.filter((c, idx) => c.length > 0 && chunks.indexOf(c) === idx);

    return cleanedChunks.map((content, index) => ({
      chunkIndex: index,
      content,
      tokenCount: this.estimateTokens(content),
    }));
  }

  /**
   * Extracts the tail words of a chunk up to maxChars for overlap continuity.
   */
  private extractOverlap(text: string, maxChars: number): string {
    if (maxChars <= 0 || text.length <= maxChars) {
      return '';
    }
    const tail = text.slice(-maxChars);
    const firstSpace = tail.indexOf(' ');
    if (firstSpace !== -1 && firstSpace < tail.length - 1) {
      return tail.slice(firstSpace + 1).trim();
    }
    return tail.trim();
  }

  /**
   * Splits a paragraph into sentences preserving punctuation.
   */
  private splitIntoSentences(text: string): string[] {
    const matches = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
    return matches ? matches.map((s) => s.trim()).filter(Boolean) : [text];
  }

  /**
   * Fallback word-aware chunker for exceptionally long sentences.
   */
  private hardSplitWords(text: string, chunkSize: number, overlap: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const result: string[] = [];
    let current = '';

    for (const word of words) {
      if ((current + ' ' + word).trim().length <= chunkSize) {
        current = current ? `${current} ${word}` : word;
      } else {
        if (current) {
          result.push(current);
          const overlapText = this.extractOverlap(current, overlap);
          current = overlapText ? `${overlapText} ${word}` : word;
        } else {
          // A single gigantic token (e.g. 600-char string without spaces)
          result.push(word.slice(0, chunkSize));
          current = word.slice(chunkSize);
        }
      }
    }

    if (current.trim().length > 0) {
      result.push(current.trim());
    }

    return result;
  }

  /**
   * Approximates token count based on whitespace tokens and word count.
   */
  estimateTokens(text: string): number {
    if (!text || text.trim().length === 0) return 0;
    const words = text.trim().split(/\s+/).length;
    // Standard approximation: 1 token ~ 0.75 words, or words * 1.3
    return Math.max(1, Math.ceil(words * 1.3));
  }
}
