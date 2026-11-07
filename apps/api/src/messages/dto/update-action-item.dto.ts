import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ActionItemStatus } from '@bhuvi/shared';

const VALID_ACTION_STATUSES: ActionItemStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export class UpdateActionItemDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(VALID_ACTION_STATUSES)
  status!: ActionItemStatus;
}
