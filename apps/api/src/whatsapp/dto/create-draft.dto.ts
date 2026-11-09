import { IsNotEmpty, IsOptional, IsString, IsUUID, IsObject } from 'class-validator';
import { CreateWhatsAppDraftDto, WhatsAppMessageType } from '@bhuvi/shared';

export class CreateDraftDto implements CreateWhatsAppDraftDto {
  @IsUUID()
  connectionId!: string;

  @IsUUID()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  recipientPhone!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  messageType?: WhatsAppMessageType;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  @IsObject()
  templateParams?: Record<string, unknown>;
}
