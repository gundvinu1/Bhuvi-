import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MemoryCategory, MemoryImportance, MemoryStatus } from '@bhuvi/shared';
import { VALID_MEMORY_CATEGORIES, VALID_MEMORY_IMPORTANCES } from './create-memory.dto';

export const VALID_MEMORY_STATUSES: MemoryStatus[] = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
];

export class QueryMemoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 20;

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
  @IsEnum(VALID_MEMORY_STATUSES, {
    message: `Status must be one of: ${VALID_MEMORY_STATUSES.join(', ')}`,
  })
  status?: MemoryStatus;

  @IsOptional()
  @IsString({ message: 'Search query must be a string' })
  search?: string;

  @IsOptional()
  @IsString({ message: 'Tag must be a string' })
  tag?: string;
}
