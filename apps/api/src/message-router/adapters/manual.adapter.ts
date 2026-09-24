import { Injectable } from '@nestjs/common';
import { ContactChannel } from '@prisma/client';

import {
  MessageResult,
  MessageRoutingStatus,
} from '../contracts/message-result.interface';

@Injectable()
export class ManualAdapter {
  async prepare(
    channel: ContactChannel,
    message: string,
    reason: string,
  ): Promise<MessageResult> {
    return {
      status: MessageRoutingStatus.PREPARED_MANUAL,
      personId: channel.personId,
      channelId: channel.id,
      platform: channel.platform,
      handle: channel.handle,
      address: channel.address,
      externalId: channel.externalId,
      profileUrl: channel.profileUrl,
      preparedText: message,
      reason,
    };
  }
}
