import { Injectable } from '@nestjs/common';
import {
  ContactChannel,
  ContactPlatform,
} from '@prisma/client';
import * as nodemailer from 'nodemailer';

import {
  MessageAdapter,
  OutboundMessage,
} from '../contracts/message-adapter.interface';
import {
  MessageResult,
  MessageRoutingStatus,
} from '../contracts/message-result.interface';

type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  secureValid: boolean;
  user: string;
  pass: string;
  from: string;
};

type EmailSendResult = {
  providerMessageId: string | null;
  subject: string;
};

@Injectable()
export class EmailAdapter implements MessageAdapter {
  readonly platform = ContactPlatform.EMAIL;

  canSendAutomatically(
    channel: ContactChannel,
  ): boolean {
    return (
      channel.platform === this.platform &&
      this.canSendToAddress(
        channel.address?.trim() ?? '',
      )
    );
  }

  canSendToAddress(address: string): boolean {
    const config = this.getConfig();

    return (
      this.isConfigValid(config) &&
      this.isValidEmail(address.trim())
    );
  }

  async sendToAddress(
    address: string,
    message: OutboundMessage,
  ): Promise<EmailSendResult> {
    const config = this.getConfig();
    const normalizedAddress = address.trim();

    if (!this.isConfigValid(config)) {
      throw new Error(
        'Email SMTP configuration is incomplete or invalid.',
      );
    }

    if (!this.isValidEmail(normalizedAddress)) {
      throw new Error(
        'Email destination address is missing or invalid.',
      );
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user && config.pass
        ? {
            auth: {
              user: config.user,
              pass: config.pass,
            },
          }
        : {}),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    const subject =
      message.subject?.trim() ||
      'Message from Personal Network Graph';

    let providerMessageId: string | null = null;

    try {
      const info = await transporter.sendMail({
        from: config.from,
        to: normalizedAddress,
        subject,
        text: message.text,
      });

      providerMessageId =
        typeof info.messageId === 'string'
          ? info.messageId
          : null;
    } catch {
      /*
       * Do not expose provider errors because they can contain
       * server details, account identifiers or transport metadata.
       */
      throw new Error(
        'Email SMTP send failed.',
      );
    } finally {
      transporter.close();
    }

    return {
      providerMessageId,
      subject,
    };
  }

  async send(
    channel: ContactChannel,
    message: OutboundMessage,
  ): Promise<MessageResult> {
    const result = await this.sendToAddress(
      channel.address?.trim() ?? '',
      message,
    );

    return {
      status: MessageRoutingStatus.SENT,
      personId: channel.personId,
      channelId: channel.id,
      platform: channel.platform,
      handle: channel.handle,
      address: channel.address,
      externalId: channel.externalId,
      profileUrl: channel.profileUrl,
      providerMessageId:
        result.providerMessageId,
      preparedText: message.text,
      subject: result.subject,
      reason:
        'Message sent automatically via Email.',
    };
  }

  private getConfig(): EmailConfig {
    const secureRaw =
      process.env.SMTP_SECURE?.trim().toLowerCase() ??
      '';

    const secureTrueValues =
      ['1', 'true', 'yes', 'on'];

    const secureFalseValues =
      ['', '0', 'false', 'no', 'off'];

    const secureValid =
      secureTrueValues.includes(secureRaw) ||
      secureFalseValues.includes(secureRaw);

    const portRaw =
      process.env.SMTP_PORT?.trim() || '587';

    return {
      host:
        process.env.SMTP_HOST?.trim() ?? '',
      port:
        Number.parseInt(portRaw, 10),
      secure:
        secureTrueValues.includes(secureRaw),
      secureValid,
      user:
        process.env.SMTP_USER?.trim() ?? '',
      pass:
        process.env.SMTP_PASS ?? '',
      from:
        process.env.EMAIL_FROM?.trim() ?? '',
    };
  }

  private isConfigValid(
    config: EmailConfig,
  ): boolean {
    const validPort =
      Number.isInteger(config.port) &&
      config.port >= 1 &&
      config.port <= 65_535;

    const authPairValid =
      Boolean(config.user) ===
      Boolean(config.pass);

    return (
      Boolean(config.host) &&
      Boolean(config.from) &&
      validPort &&
      config.secureValid &&
      authPairValid
    );
  }

  private isValidEmail(
    value: string,
  ): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      value,
    );
  }
}
