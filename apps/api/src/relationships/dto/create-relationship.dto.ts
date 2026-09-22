import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateRelationshipDto {
  @IsUUID()
  fromId!: string;

  @IsUUID()
  toId!: string;

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
