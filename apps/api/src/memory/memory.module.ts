import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@bhuvi/database';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { MemoryController } from './memory.controller';
import { MemoryService } from './services/memory.service';
import { ChunkingService } from './services/chunking.service';
import { EmbeddingService } from './services/embedding.service';
import { VectorSearchService } from './services/vector-search.service';
import { RagService } from './services/rag.service';
import { SecretDetectorService } from './services/secret-detector.service';

@Module({
  imports: [ConfigModule, PrismaModule, forwardRef(() => AiModule), AuthModule],
  controllers: [MemoryController],
  providers: [
    MemoryService,
    ChunkingService,
    EmbeddingService,
    VectorSearchService,
    RagService,
    SecretDetectorService,
  ],
  exports: [
    MemoryService,
    ChunkingService,
    EmbeddingService,
    VectorSearchService,
    RagService,
    SecretDetectorService,
  ],
})
export class MemoryModule {}
