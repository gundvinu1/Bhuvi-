import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CreateWhatsAppConnectionDto } from '@bhuvi/shared';

export class ConnectWhatsAppDto implements CreateWhatsAppConnectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  businessAccountId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  phoneNumberId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  displayPhoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName!: string;

  @IsString()
  @IsNotEmpty()
  accessToken!: string;
}
