import { Module } from '@nestjs/common';
import { PrismaModule } from '@bhuvi/database';
import { AiModule } from '../ai/ai.module';
import { MessagesModule } from '../messages/messages.module';
import { MemoryModule } from '../memory/memory.module';
import { WhatsAppEncryptionService } from './services/whatsapp-encryption.service';
import { WhatsAppConnectionService } from './services/whatsapp-connection.service';
import { WhatsAppWebhookService } from './services/whatsapp-webhook.service';
import { WhatsAppConversationService } from './services/whatsapp-conversation.service';
import { WhatsAppDraftService } from './services/whatsapp-draft.service';
import { WhatsAppAiService } from './services/whatsapp-ai.service';
import { WhatsAppController } from './whatsapp.controller';

@Module({
  imports: [PrismaModule, AiModule, MessagesModule, MemoryModule],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppEncryptionService,
    WhatsAppConnectionService,
    WhatsAppWebhookService,
    WhatsAppConversationService,
    WhatsAppDraftService,
    WhatsAppAiService,
  ],
  exports: [
    WhatsAppEncryptionService,
    WhatsAppConnectionService,
    WhatsAppWebhookService,
    WhatsAppConversationService,
    WhatsAppDraftService,
    WhatsAppAiService,
  ],
})
export class WhatsAppModule {}
