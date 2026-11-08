import { IsNotEmpty, IsString, IsOptional, IsNumber, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class AskMemoryDto {
  @IsNotEmpty({ message: 'Question cannot be empty' })
  @IsString({ message: 'Question must be a string' })
  @MaxLength(1000, { message: 'Question cannot exceed 1000 characters' })
  question!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(10, { message: 'Limit cannot exceed 10' })
  limit?: number = 4;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'minSimilarity must be a number between 0 and 1' })
  @Min(0, { message: 'minSimilarity cannot be less than 0' })
  @Max(1, { message: 'minSimilarity cannot exceed 1' })
  minSimilarity?: number = 0.45;
}
