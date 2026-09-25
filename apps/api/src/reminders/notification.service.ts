import { Injectable } from '@nestjs/common';
import { ReminderDeliveryChannel } from '@prisma/client';

import { EmailAdapter } from '../message-router/adapters/email.adapter';
import { TelegramAdapter } from '../message-router/adapters/telegram.adapter';

export interface NotificationSendResult {
  providerMessageId: string | null;
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly telegramAdapter: TelegramAdapter,
    private readonly emailAdapter: EmailAdapter,
  ) {}

  async send(
    channel: ReminderDeliveryChannel,
    text: string,
    subject: string,
  ): Promise<NotificationSendResult> {
    if (channel === ReminderDeliveryChannel.TELEGRAM) {
      const chatId =
        process.env.NOTIFICATION_TELEGRAM_CHAT_ID?.trim() ?? '';

      if (!this.telegramAdapter.canSendToChat(chatId)) {
        throw new Error(
          'Telegram notification destination is not configured.',
        );
      }

      const providerMessageId =
        await this.telegramAdapter.sendToChat(chatId, {
          text,
        });

      return { providerMessageId };
    }

    const address =
      process.env.NOTIFICATION_EMAIL_TO?.trim() ?? '';

    if (!this.emailAdapter.canSendToAddress(address)) {
      throw new Error(
        'Email notification destination is not configured.',
      );
    }

    const result =
      await this.emailAdapter.sendToAddress(address, {
        text,
        subject,
      });

    return {
      providerMessageId: result.providerMessageId,
    };
  }
}
