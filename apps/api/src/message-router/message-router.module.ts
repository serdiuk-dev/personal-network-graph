import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma.module';
import { ManualAdapter } from './adapters/manual.adapter';
import {
  MESSAGE_ADAPTERS,
} from './contracts/message-adapter.interface';
import { MessageController } from './message.controller';
import { MessageRouterService } from './message-router.service';

@Module({
  imports: [PrismaModule],
  controllers: [MessageController],
  providers: [
    MessageRouterService,
    ManualAdapter,
    {
      provide: MESSAGE_ADAPTERS,
      useValue: [],
    },
  ],
  exports: [MessageRouterService],
})
export class MessageRouterModule {}
