import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class SuggestReplyDto {
  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsString()
  guidance?: string;
}

export class AskWhatsAppDto {
  @IsString()
  @IsNotEmpty()
  question!: string;

  @IsOptional()
  @IsString()
  connectionId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}
