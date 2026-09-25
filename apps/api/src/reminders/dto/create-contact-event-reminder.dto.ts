import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateContactEventReminderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsDateString()
  eventAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsDateString()
  dueAt!: string;
}
