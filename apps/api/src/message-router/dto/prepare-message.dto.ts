import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class PrepareMessageDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}
