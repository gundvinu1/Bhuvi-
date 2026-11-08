import { IsString, IsEnum, IsOptional, MaxLength, IsArray, IsDateString } from 'class-validator';
import { MemoryCategory, MemoryImportance } from '@bhuvi/shared';
import { VALID_MEMORY_CATEGORIES, VALID_MEMORY_IMPORTANCES } from './create-memory.dto';

export class UpdateMemoryDto {
  @IsOptional()
  @IsString({ message: 'Title must be a string' })
  @MaxLength(200, { message: 'Title cannot exceed 200 characters' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Content must be a string' })
  @MaxLength(50000, { message: 'Content cannot exceed 50000 characters' })
  content?: string;

  @IsOptional()
  @IsEnum(VALID_MEMORY_CATEGORIES, {
    message: `Category must be one of: ${VALID_MEMORY_CATEGORIES.join(', ')}`,
  })
  category?: MemoryCategory;

  @IsOptional()
  @IsEnum(VALID_MEMORY_IMPORTANCES, {
    message: `Importance must be one of: ${VALID_MEMORY_IMPORTANCES.join(', ')}`,
  })
  importance?: MemoryImportance;

  @IsOptional()
  @IsArray({ message: 'Tags must be an array of strings' })
  @IsString({ each: true, message: 'Each tag must be a string' })
  tags?: string[];

  @IsOptional()
  @IsDateString({}, { message: 'expiresAt must be a valid ISO date string' })
  expiresAt?: string | null;
}
