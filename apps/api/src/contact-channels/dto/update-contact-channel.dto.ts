import { ContactPlatform } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateContactChannelDto {
  @IsOptional()
  @IsEnum(ContactPlatform)
  platform?: ContactPlatform;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  handle?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  address?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  profileUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPreferred?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  automationAllowed?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
