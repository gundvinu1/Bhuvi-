import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  MaxLength,
  IsArray,
  IsDateString,
} from 'class-validator';
import { MemoryCategory, MemoryImportance } from '@bhuvi/shared';

export const VALID_MEMORY_CATEGORIES: MemoryCategory[] = [
  'PERSONAL',
  'PROJECT',
  'EDUCATION',
  'WORK',
  'BUSINESS',
  'IMPORTANT_EVENTS',
  'NOTES',
  'CONVERSATION',
];

export const VALID_MEMORY_IMPORTANCES: MemoryImportance[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export class CreateMemoryDto {
  @IsNotEmpty({ message: 'Title is required' })
  @IsString({ message: 'Title must be a string' })
  @MaxLength(200, { message: 'Title cannot exceed 200 characters' })
  title!: string;

  @IsNotEmpty({ message: 'Content is required' })
  @IsString({ message: 'Content must be a string' })
  @MaxLength(50000, { message: 'Content cannot exceed 50000 characters' })
  content!: string;

  @IsNotEmpty({ message: 'Category is required' })
  @IsEnum(VALID_MEMORY_CATEGORIES, {
    message: `Category must be one of: ${VALID_MEMORY_CATEGORIES.join(', ')}`,
  })
  category!: MemoryCategory;

  @IsOptional()
  @IsEnum(VALID_MEMORY_IMPORTANCES, {
    message: `Importance must be one of: ${VALID_MEMORY_IMPORTANCES.join(', ')}`,
  })
  importance?: MemoryImportance;

  @IsOptional()
  @IsString({ message: 'Source must be a string' })
  @MaxLength(100, { message: 'Source cannot exceed 100 characters' })
  source?: string;

  @IsOptional()
  @IsArray({ message: 'Tags must be an array of strings' })
  @IsString({ each: true, message: 'Each tag must be a string' })
  tags?: string[];

  @IsOptional()
  @IsDateString({}, { message: 'expiresAt must be a valid ISO date string' })
  expiresAt?: string;
}
