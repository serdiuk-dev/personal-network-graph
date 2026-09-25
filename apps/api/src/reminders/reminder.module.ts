import { Module } from '@nestjs/common';

import { MessageRouterModule } from '../message-router/message-router.module';
import { PrismaModule } from '../prisma.module';
import { NotificationService } from './notification.service';
import { ReminderController } from './reminder.controller';
import { ReminderService } from './reminder.service';

@Module({
  imports: [
    PrismaModule,
    MessageRouterModule,
  ],
  controllers: [ReminderController],
  providers: [
    NotificationService,
    ReminderService,
  ],
  exports: [
    ReminderService,
  ],
})
export class ReminderModule {}
