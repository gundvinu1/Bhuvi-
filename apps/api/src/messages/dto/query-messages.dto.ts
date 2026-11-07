import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsDateString,
  IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  MessageCategory,
  MessagePriority,
  MessageUrgency,
  MessageProcessingStatus,
} from '@bhuvi/shared';

const VALID_CATEGORIES: MessageCategory[] = [
  'PERSONAL',
  'WORK',
  'EDUCATION',
  'FINANCIAL',
  'BUSINESS',
  'SOCIAL',
  'PROMOTIONAL',
  'TRANSACTIONAL',
  'NOTIFICATION',
  'OTHER',
];

const VALID_PRIORITIES: MessagePriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const VALID_URGENCIES: MessageUrgency[] = ['URGENT', 'TIME_SENSITIVE', 'NORMAL', 'NONE'];

const VALID_STATUSES: MessageProcessingStatus[] = [
  'RECEIVED',
  'VALIDATING',
  'PROCESSING',
  'ANALYZING',
  'COMPLETED',
  'FAILED',
  'RETRY_PENDING',
];

export class QueryMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @IsIn(VALID_CATEGORIES)
  category?: MessageCategory;

  @IsOptional()
  @IsString()
  @IsIn(VALID_PRIORITIES)
  priority?: MessagePriority;

  @IsOptional()
  @IsString()
  @IsIn(VALID_URGENCIES)
  urgency?: MessageUrgency;

  @IsOptional()
  @IsString()
  @IsIn(VALID_STATUSES)
  status?: MessageProcessingStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  requiresAction?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  requiresReply?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
