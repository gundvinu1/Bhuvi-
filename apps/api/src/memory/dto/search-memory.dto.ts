import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MemoryCategory } from '@bhuvi/shared';
import { VALID_MEMORY_CATEGORIES } from './create-memory.dto';

export class SearchMemoryDto {
  @IsNotEmpty({ message: 'Search query cannot be empty' })
  @IsString({ message: 'Search query must be a string' })
  @MaxLength(1000, { message: 'Search query cannot exceed 1000 characters' })
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(50, { message: 'Limit cannot exceed 50' })
  limit?: number = 5;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Threshold must be a number between 0 and 1' })
  @Min(0, { message: 'Threshold cannot be less than 0' })
  @Max(1, { message: 'Threshold cannot exceed 1' })
  threshold?: number = 0.5;

  @IsOptional()
  @IsEnum(VALID_MEMORY_CATEGORIES, {
    message: `Category must be one of: ${VALID_MEMORY_CATEGORIES.join(', ')}`,
  })
  category?: MemoryCategory;
}
