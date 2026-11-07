import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApprovalDecisionDto {
  @IsOptional()
  @IsString({ message: 'Decision reason must be a string' })
  @MaxLength(500, { message: 'Decision reason cannot exceed 500 characters' })
  reason?: string;
}
