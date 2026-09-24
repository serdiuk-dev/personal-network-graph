import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma.module';
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
    {
      provide: MESSAGE_ADAPTERS,
      inject: [TelegramAdapter],
      useFactory: (
        telegramAdapter: TelegramAdapter,
      ): MessageAdapter[] => [
        telegramAdapter,
      ],
    },
  ],
  exports: [MessageRouterService],
})
export class MessageRouterModule {}
