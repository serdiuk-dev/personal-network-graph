import {
  ContactChannel,
  ContactPlatform,
} from '@prisma/client';

import { MessageResult } from './message-result.interface';

export const MESSAGE_ADAPTERS = Symbol('MESSAGE_ADAPTERS');

export interface MessageAdapter {
  readonly platform: ContactPlatform;

  canSendAutomatically(
    channel: ContactChannel,
  ): boolean;

  send(
    channel: ContactChannel,
    message: string,
  ): Promise<MessageResult>;
}
