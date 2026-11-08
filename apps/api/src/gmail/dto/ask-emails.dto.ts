import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AskEmailsDto {
  @IsNotEmpty({ message: 'Question cannot be empty' })
  @IsString({ message: 'Question must be a string' })
  @MaxLength(2000, { message: 'Question cannot exceed 2000 characters' })
  question!: string;
}
