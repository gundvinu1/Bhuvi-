import { IsString, IsNotEmpty, IsOptional, MaxLength, MinLength } from 'class-validator';

export class AnalyzePreviewDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(20000)
  content!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  senderName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  subject?: string;
}
