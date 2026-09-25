import { Injectable } from '@nestjs/common';
import {
  ContactChannel,
  ContactPlatform,
} from '@prisma/client';

import {
  MessageAdapter,
  OutboundMessage,
} from '../contracts/message-adapter.interface';
import {
  MessageResult,
  MessageRoutingStatus,
} from '../contracts/message-result.interface';

interface TelegramSendMessageResponse {
  ok: boolean;
  result?: {
    message_id: number;
  };
  description?: string;
  error_code?: number;
}

@Injectable()
export class TelegramAdapter implements MessageAdapter {
  readonly platform = ContactPlatform.TELEGRAM;

  private readonly botToken =
    process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '';

  canSendAutomatically(
    channel: ContactChannel,
  ): boolean {
    return (
      channel.platform === this.platform &&
      this.canSendToChat(
        channel.externalId?.trim() ?? '',
      )
    );
  }

  canSendToChat(chatId: string): boolean {
    return (
      this.botToken.length > 0 &&
      chatId.trim().length > 0
    );
  }

  async sendToChat(
    chatId: string,
    message: OutboundMessage,
  ): Promise<string | null> {
    const normalizedChatId = chatId.trim();

    if (!this.botToken) {
      throw new Error(
        'Telegram Bot API is not configured.',
      );
    }

    if (!normalizedChatId) {
      throw new Error(
        'Telegram chat ID is missing.',
      );
    }

    const url =
      `https://api.telegram.org/bot` +
      `${this.botToken}/sendMessage`;

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: normalizedChatId,
          text: message.text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new Error(
        'Telegram Bot API request failed.',
      );
    }

    let payload: TelegramSendMessageResponse;

    try {
      payload =
        (await response.json()) as
          TelegramSendMessageResponse;
    } catch {
      throw new Error(
        `Telegram Bot API returned an invalid response ` +
        `(HTTP ${response.status}).`,
      );
    }

    if (!response.ok || !payload.ok) {
      const apiCode = payload.error_code
        ? `, Telegram code ${payload.error_code}`
        : '';

      const description =
        payload.description ??
        'Unknown Telegram error';

      throw new Error(
        `Telegram sendMessage failed ` +
        `(HTTP ${response.status}${apiCode}): ` +
        description,
      );
    }

    return payload.result?.message_id != null
      ? String(payload.result.message_id)
      : null;
  }

  async send(
    channel: ContactChannel,
    message: OutboundMessage,
  ): Promise<MessageResult> {
    const chatId = channel.externalId?.trim() ?? '';

    const providerMessageId =
      await this.sendToChat(chatId, message);

    return {
      status: MessageRoutingStatus.SENT,
      personId: channel.personId,
      channelId: channel.id,
      platform: channel.platform,
      handle: channel.handle,
      address: channel.address,
      externalId: channel.externalId,
      profileUrl: channel.profileUrl,
      providerMessageId,
      preparedText: message.text,
      subject: message.subject,
      reason:
        'Message sent automatically via Telegram.',
    };
  }
}
