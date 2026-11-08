import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { MemoryModule } from '../memory/memory.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OllamaProvider } from './ollama.provider';

@Module({
  imports: [ConfigModule, AuthModule, forwardRef(() => MemoryModule)],
  controllers: [AiController],
  providers: [AiService, OllamaProvider],
  exports: [AiService, OllamaProvider],
})
export class AiModule {}
