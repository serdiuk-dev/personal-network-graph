import {
  IsHexColor,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateGraphStylesDto {
  @IsOptional()
  @IsHexColor()
  innerRingColor?: string;

  @IsOptional()
  @IsHexColor()
  middleRingColor?: string;

  @IsOptional()
  @IsHexColor()
  outerRingColor?: string;

  @IsOptional()
  @IsHexColor()
  innerEgoColor?: string;

  @IsOptional()
  @IsHexColor()
  middleEgoColor?: string;

  @IsOptional()
  @IsHexColor()
  outerEgoColor?: string;

  @IsOptional()
  @IsHexColor()
  relationshipDefaultColor?: string;

  @IsOptional()
  @IsHexColor()
  relationshipFocusColor?: string;

  @IsOptional()
  @IsHexColor()
  relationshipInactiveColor?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  innerRingOpacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  middleRingOpacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  outerRingOpacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  innerEgoOpacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  middleEgoOpacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  outerEgoOpacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  relationshipDefaultOpacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  relationshipFocusOpacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  relationshipInactiveOpacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10)
  innerRingWidth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10)
  middleRingWidth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10)
  outerRingWidth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10)
  innerEgoWidth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10)
  middleEgoWidth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10)
  outerEgoWidth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10)
  relationshipInactiveWidth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(5)
  relationshipDefaultWidthScale?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(5)
  relationshipFocusWidthScale?: number;

}
