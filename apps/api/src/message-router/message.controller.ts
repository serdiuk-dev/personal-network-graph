import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import { SendMessageDto } from './dto/send-message.dto';
import { MessageRouterService } from './message-router.service';

@Controller('people/:personId/messages')
export class MessageController {
  constructor(
    private readonly messageRouterService: MessageRouterService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  sendMessage(
    @Param('personId') personId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messageRouterService.sendMessage(
      personId,
      dto,
    );
  }
}
