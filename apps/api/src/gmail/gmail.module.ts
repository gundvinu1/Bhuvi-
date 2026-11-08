import { Module } from '@nestjs/common';
import { PrismaModule } from '@bhuvi/database';
import { AiModule } from '../ai/ai.module';
import { MessagesModule } from '../messages/messages.module';
import { MemoryModule } from '../memory/memory.module';
import { TokenEncryptionService } from './services/token-encryption.service';
import { EmailParserService } from './services/email-parser.service';
import { GmailOAuthService } from './services/gmail-oauth.service';
import { GmailSyncService } from './services/gmail-sync.service';
import { GmailAiService } from './services/gmail-ai.service';
import { GmailDraftService } from './services/gmail-draft.service';
import { GmailController } from './gmail.controller';

@Module({
  imports: [PrismaModule, AiModule, MessagesModule, MemoryModule],
  controllers: [GmailController],
  providers: [
    TokenEncryptionService,
    EmailParserService,
    GmailOAuthService,
    GmailSyncService,
    GmailAiService,
    GmailDraftService,
  ],
  exports: [
    TokenEncryptionService,
    EmailParserService,
    GmailOAuthService,
    GmailSyncService,
    GmailAiService,
    GmailDraftService,
  ],
})
export class GmailModule {}
