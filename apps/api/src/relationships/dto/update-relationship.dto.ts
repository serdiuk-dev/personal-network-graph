import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateRelationshipDto {
  @IsOptional()
  @IsUUID()
  fromId?: string;

  @IsOptional()
  @IsUUID()
  toId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  type?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  strength?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
