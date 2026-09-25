import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma.module';
import { EmailAdapter } from './adapters/email.adapter';
import { ManualAdapter } from './adapters/manual.adapter';
import { TelegramAdapter } from './adapters/telegram.adapter';
import {
  MESSAGE_ADAPTERS,
  MessageAdapter,
} from './contracts/message-adapter.interface';
import { MessageController } from './message.controller';
import { MessageRouterService } from './message-router.service';

@Module({
  imports: [PrismaModule],
  controllers: [MessageController],
  providers: [
    MessageRouterService,
    ManualAdapter,
    TelegramAdapter,
    EmailAdapter,
    {
      provide: MESSAGE_ADAPTERS,
      inject: [
        TelegramAdapter,
        EmailAdapter,
      ],
      useFactory: (
        telegramAdapter: TelegramAdapter,
        emailAdapter: EmailAdapter,
      ): MessageAdapter[] => [
        telegramAdapter,
        emailAdapter,
      ],
    },
  ],
  exports: [
    MessageRouterService,
    TelegramAdapter,
    EmailAdapter,
  ],
})
export class MessageRouterModule {}
