import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  MinLength,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  senderName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  senderIdentifier?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  subject?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(20000)
  content!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  source?: string;

  @IsDateString()
  @IsOptional()
  receivedAt?: string;

  @IsBoolean()
  @IsOptional()
  autoAnalyze?: boolean = true;
}
