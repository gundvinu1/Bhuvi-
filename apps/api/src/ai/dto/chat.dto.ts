import { IsNotEmpty, IsString, MaxLength, Matches, IsOptional, IsBoolean } from 'class-validator';

export class ChatDto {
  @IsNotEmpty({ message: 'Message cannot be empty' })
  @IsString({ message: 'Message must be a string' })
  @Matches(/\S/, { message: 'Message cannot be empty or only whitespace' })
  @MaxLength(4000, { message: 'Message cannot exceed 4000 characters' })
  message!: string;

  @IsOptional()
  @IsBoolean({ message: 'useMemory must be a boolean' })
  useMemory?: boolean;
}
