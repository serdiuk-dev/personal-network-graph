import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContactChannel,
  ContactPlatform,
} from '@prisma/client';

import { PrismaService } from '../prisma.service';
import { ManualAdapter } from './adapters/manual.adapter';
import {
  MESSAGE_ADAPTERS,
  MessageAdapter,
} from './contracts/message-adapter.interface';
import {
  MessageResult,
  MessageRoutingStatus,
} from './contracts/message-result.interface';
import { PrepareMessageDto } from './dto/prepare-message.dto';
import {
  MessageMode,
  SendMessageDto,
} from './dto/send-message.dto';

@Injectable()
export class MessageRouterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manualAdapter: ManualAdapter,
    @Inject(MESSAGE_ADAPTERS)
    private readonly adapters: MessageAdapter[],
  ) {}

  async sendMessage(
    personId: string,
    dto: SendMessageDto,
  ): Promise<MessageResult> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { id: true },
    });

    if (!person) {
      throw new NotFoundException(
        `Person ${personId} not found`,
      );
    }

    const channels = await this.prisma.contactChannel.findMany({
      where: {
        personId,
        isActive: true,
      },
      orderBy: [
        { isPreferred: 'desc' },
        { priority: 'asc' },
        { platform: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    if (channels.length === 0) {
      return {
        status: MessageRoutingStatus.NO_CHANNEL,
        personId,
        preparedText: dto.text,
        reason: 'No active contact channels are available.',
      };
    }

    const primaryChannel = channels[0];
    const mode =
      dto.mode ?? MessageMode.AUTO_WITH_FALLBACK;

    if (mode === MessageMode.MANUAL_ONLY) {
      return this.manualAdapter.prepare(
        primaryChannel,
        dto.text,
        'Manual preparation was requested.',
      );
    }

    let hasAutomationAllowedChannel = false;
    let hasPlatformAdapter = false;
    let hasCapableAdapter = false;

    for (const channel of channels) {
      if (!channel.automationAllowed) {
        continue;
      }

      hasAutomationAllowedChannel = true;

      const adapter = this.findAdapter(
        channel.platform,
      );

      if (!adapter) {
        continue;
      }

      hasPlatformAdapter = true;

      if (!adapter.canSendAutomatically(channel)) {
        continue;
      }

      hasCapableAdapter = true;

      try {
        const result = await adapter.send(
          channel,
          dto.text,
        );

        if (
          result.status ===
          MessageRoutingStatus.SENT
        ) {
          return result;
        }
      } catch {
        /*
         * Adapter failure must not terminate routing.
         * Continue with the next active channel.
         */
      }
    }

    return this.manualAdapter.prepare(
      primaryChannel,
      dto.text,
      this.getManualFallbackReason(
        hasAutomationAllowedChannel,
        hasPlatformAdapter,
        hasCapableAdapter,
      ),
    );
  }

  async prepareMessage(
    personId: string,
    dto: PrepareMessageDto,
  ): Promise<MessageResult> {
    return this.sendMessage(personId, {
      text: dto.text,
      mode: MessageMode.MANUAL_ONLY,
    });
  }

  private findAdapter(
    platform: ContactPlatform,
  ): MessageAdapter | undefined {
    return this.adapters.find(
      (adapter) => adapter.platform === platform,
    );
  }

  private getManualFallbackReason(
    hasAutomationAllowedChannel: boolean,
    hasPlatformAdapter: boolean,
    hasCapableAdapter: boolean,
  ): string {
    if (!hasAutomationAllowedChannel) {
      return (
        'Automatic sending is not allowed ' +
        'for the available channels.'
      );
    }

    if (!hasPlatformAdapter) {
      return (
        'Automatic sending is not available ' +
        'for the available channels.'
      );
    }

    if (!hasCapableAdapter) {
      return (
        'No automatic adapter can currently send ' +
        'through the available channels.'
      );
    }

    return (
      'Automatic sending could not be completed; ' +
      'manual preparation was created.'
    );
  }
}
