// ============================================================
// BHUVI – Personal Memory & Knowledge System Types
// Module 08: Long-Term Memory, Embeddings & RAG
// ============================================================

export type MemoryCategory =
  | 'PERSONAL'
  | 'PROJECT'
  | 'EDUCATION'
  | 'WORK'
  | 'BUSINESS'
  | 'IMPORTANT_EVENTS'
  | 'NOTES'
  | 'CONVERSATION';

export type MemoryImportance = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type MemoryStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface MemoryTagDto {
  id: string;
  name: string;
}

export interface MemoryChunkDto {
  id: string;
  memoryId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  dimensions: number;
  modelName: string;
  createdAt: string;
}

export interface MemoryDto {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: MemoryCategory;
  importance: MemoryImportance;
  source: string;
  status: MemoryStatus;
  errorMessage?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  chunks?: MemoryChunkDto[];
  chunksCount?: number;
}

export interface MemoryStatsDto {
  totalMemories: number;
  completedMemories: number;
  pendingMemories: number;
  failedMemories: number;
  totalChunks: number;
  categoryDistribution: Record<MemoryCategory, number>;
}

export interface MemorySearchResult {
  memoryId: string;
  chunkId: string;
  title: string;
  category: MemoryCategory;
  importance: MemoryImportance;
  chunkContent: string;
  similarity: number;
  source: string;
  createdAt: string;
}

export interface MemorySourceReference {
  memoryId: string;
  title: string;
  category: MemoryCategory;
  relevanceScore: number;
  snippet: string;
}

export interface MemoryAskResult {
  question: string;
  answer: string;
  sources: MemorySourceReference[];
  confidence: number;
  foundRelevantMemory: boolean;
  durationMs: number;
}

export interface MemoryConflictResult {
  hasConflict: boolean;
  conflictingMemoryId?: string;
  conflictingMemoryTitle?: string;
  similarity: number;
  explanation?: string;
}
