import { IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';

export class CreatePlanDto {
  @IsNotEmpty({ message: 'Message cannot be empty' })
  @IsString({ message: 'Message must be a string' })
  @Matches(/\S/, { message: 'Message cannot be empty or only whitespace' })
  @MaxLength(4000, { message: 'Message cannot exceed 4000 characters' })
  message!: string;
}
