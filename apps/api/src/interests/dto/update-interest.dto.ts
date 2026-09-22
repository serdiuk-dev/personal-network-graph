import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateInterestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
