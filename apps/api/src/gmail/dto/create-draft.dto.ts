import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDraftDto {
  @IsNotEmpty({ message: 'Recipient email is required' })
  @IsEmail({}, { message: 'A valid recipient email is required' })
  to!: string;

  @IsNotEmpty({ message: 'Subject is required' })
  @IsString({ message: 'Subject must be a string' })
  @MaxLength(500, { message: 'Subject cannot exceed 500 characters' })
  subject!: string;

  @IsNotEmpty({ message: 'Draft body is required' })
  @IsString({ message: 'Draft body must be a string' })
  @MaxLength(50000, { message: 'Draft body cannot exceed 50000 characters' })
  body!: string;

  @IsOptional()
  @IsString({ message: 'Thread ID must be a string' })
  threadId?: string;

  @IsOptional()
  @IsString({ message: 'Connection ID must be a string' })
  connectionId?: string;
}
