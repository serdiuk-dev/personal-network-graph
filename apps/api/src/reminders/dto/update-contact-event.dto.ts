import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateContactEventDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsDateString()
  eventAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
