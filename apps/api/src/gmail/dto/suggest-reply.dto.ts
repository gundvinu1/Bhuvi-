import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuggestReplyDto {
  @IsOptional()
  @IsString({ message: 'Custom instruction must be a string' })
  @MaxLength(1000, { message: 'Custom instruction cannot exceed 1000 characters' })
  instruction?: string;
}
