import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export enum MessageMode {
  AUTO_WITH_FALLBACK = 'AUTO_WITH_FALLBACK',
  MANUAL_ONLY = 'MANUAL_ONLY',
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsEnum(MessageMode)
  mode?: MessageMode;
}
