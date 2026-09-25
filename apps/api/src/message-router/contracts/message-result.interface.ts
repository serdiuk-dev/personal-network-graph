import { ContactPlatform } from '@prisma/client';

export enum MessageRoutingStatus {
  SENT = 'SENT',
  PREPARED_MANUAL = 'PREPARED_MANUAL',
  FAILED = 'FAILED',
  NO_CHANNEL = 'NO_CHANNEL',
  AUTO_SEND_NOT_ALLOWED = 'AUTO_SEND_NOT_ALLOWED',
  UNSUPPORTED = 'UNSUPPORTED',
}

export interface MessageResult {
  status: MessageRoutingStatus;
  personId: string;
  channelId?: string;
  platform?: ContactPlatform;
  handle?: string | null;
  address?: string | null;
  externalId?: string | null;
  profileUrl?: string | null;
  providerMessageId?: string | null;
  preparedText?: string;
  subject?: string;
  reason: string;
}
