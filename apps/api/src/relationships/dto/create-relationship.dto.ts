import {
  IsHexColor,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
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

  @IsOptional()
  @IsHexColor()
  visualColor?: string | null;

  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0.25)
  @Max(8)
  visualWidth?: number | null;
}
