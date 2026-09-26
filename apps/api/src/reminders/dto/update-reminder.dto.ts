import { IsDateString } from 'class-validator';

export class UpdateReminderDto {
  @IsDateString()
  dueAt!: string;
}
