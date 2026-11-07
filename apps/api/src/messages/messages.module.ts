import { Module } from '@nestjs/common';
import { PrismaModule } from '@bhuvi/database';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './services/messages.service';
import { MessageIntelligenceService } from './services/message-intelligence.service';
import { DuplicateDetectorService } from './services/duplicate-detector.service';

@Module({
  imports: [PrismaModule, AiModule, AuthModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessageIntelligenceService, DuplicateDetectorService],
  exports: [MessagesService, MessageIntelligenceService, DuplicateDetectorService],
})
export class MessagesModule {}
