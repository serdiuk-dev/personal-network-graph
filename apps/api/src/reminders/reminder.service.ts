import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ReminderDeliveryChannel,
  ReminderDeliveryStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma.service';
import { CreateContactEventReminderDto } from './dto/create-contact-event-reminder.dto';
import { UpdateContactEventDto } from './dto/update-contact-event.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { NotificationService } from './notification.service';

@Injectable()
export class ReminderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(
    personId: string,
    dto: CreateContactEventReminderDto,
  ) {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { id: true },
    });

    if (!person) {
      throw new NotFoundException(
        `Person ${personId} not found`,
      );
    }

    return this.prisma.contactEvent.create({
      data: {
        personId,
        type: dto.type.trim(),
        title: dto.title.trim(),
        eventAt: dto.eventAt
          ? new Date(dto.eventAt)
          : null,
        note: dto.note?.trim() || null,
        reminders: {
          create: {
            dueAt: new Date(dto.dueAt),
          },
        },
      },
      include: {
        reminders: true,
      },
    });
  }

  async findByPerson(personId: string) {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { id: true },
    });

    if (!person) {
      throw new NotFoundException(
        `Person ${personId} not found`,
      );
    }

    return this.prisma.contactEvent.findMany({
      where: { personId },
      orderBy: [
        { eventAt: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        reminders: {
          orderBy: {
            dueAt: 'asc',
          },
          include: {
            deliveries: {
              orderBy: {
                channel: 'asc',
              },
            },
          },
        },
      },
    });
  }

  async updateEvent(
    id: string,
    dto: UpdateContactEventDto,
  ) {
    const event = await this.prisma.contactEvent.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException(
        `ContactEvent ${id} not found`,
      );
    }

    const hasChanges =
      dto.type !== undefined ||
      dto.title !== undefined ||
      dto.eventAt !== undefined ||
      dto.note !== undefined;

    if (!hasChanges) {
      throw new BadRequestException(
        'At least one contact event field must be provided',
      );
    }

    return this.prisma.contactEvent.update({
      where: { id },
      data: {
        ...(dto.type !== undefined
          ? { type: dto.type.trim() }
          : {}),
        ...(dto.title !== undefined
          ? { title: dto.title.trim() }
          : {}),
        ...(dto.eventAt !== undefined
          ? {
              eventAt: dto.eventAt
                ? new Date(dto.eventAt)
                : null,
            }
          : {}),
        ...(dto.note !== undefined
          ? { note: dto.note?.trim() || null }
          : {}),
      },
      include: {
        reminders: {
          orderBy: {
            dueAt: 'asc',
          },
          include: {
            deliveries: {
              orderBy: {
                channel: 'asc',
              },
            },
          },
        },
      },
    });
  }

  async updateReminder(
    id: string,
    dto: UpdateReminderDto,
  ) {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id },
      select: {
        id: true,
        completedAt: true,
        _count: {
          select: {
            deliveries: true,
          },
        },
      },
    });

    if (!reminder) {
      throw new NotFoundException(
        `Reminder ${id} not found`,
      );
    }

    if (
      reminder.completedAt ||
      reminder._count.deliveries > 0
    ) {
      throw new ConflictException(
        `Reminder ${id} has already started delivery and cannot be rescheduled`,
      );
    }

    return this.prisma.reminder.update({
      where: { id },
      data: {
        dueAt: new Date(dto.dueAt),
      },
      include: {
        deliveries: {
          orderBy: {
            channel: 'asc',
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const reminder =
      await this.prisma.reminder.findUnique({
        where: { id },
        include: {
          event: {
            include: {
              person: true,
            },
          },
          deliveries: {
            orderBy: {
              channel: 'asc',
            },
          },
        },
      });

    if (!reminder) {
      throw new NotFoundException(
        `Reminder ${id} not found`,
      );
    }

    return reminder;
  }

  async removeReminder(id: string) {
    const reminder =
      await this.prisma.reminder.findUnique({
        where: { id },
        select: { id: true },
      });

    if (!reminder) {
      throw new NotFoundException(
        `Reminder ${id} not found`,
      );
    }

    const processingDeliveries =
      await this.prisma.reminderDelivery.count({
        where: {
          reminderId: id,
          status: ReminderDeliveryStatus.PROCESSING,
        },
      });

    if (processingDeliveries > 0) {
      throw new ConflictException(
        `Reminder ${id} is currently processing`,
      );
    }

    return this.prisma.reminder.delete({
      where: { id },
    });
  }

  async removeEvent(id: string) {
    const event =
      await this.prisma.contactEvent.findUnique({
        where: { id },
        select: { id: true },
      });

    if (!event) {
      throw new NotFoundException(
        `ContactEvent ${id} not found`,
      );
    }

    const processingDeliveries =
      await this.prisma.reminderDelivery.count({
        where: {
          reminder: {
            eventId: id,
          },
          status: ReminderDeliveryStatus.PROCESSING,
        },
      });

    if (processingDeliveries > 0) {
      throw new ConflictException(
        `ContactEvent ${id} has a reminder currently processing`,
      );
    }

    return this.prisma.contactEvent.delete({
      where: { id },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processDueReminders(): Promise<void> {
    const dueReminders =
      await this.prisma.reminder.findMany({
        where: {
          dueAt: {
            lte: new Date(),
          },
          completedAt: null,
        },
        orderBy: {
          dueAt: 'asc',
        },
        take: 50,
        select: {
          id: true,
        },
      });

    for (const reminder of dueReminders) {
      await this.processReminder(reminder.id);
    }
  }

  private async processReminder(
    reminderId: string,
  ): Promise<void> {
    const reminder =
      await this.prisma.reminder.findUnique({
        where: {
          id: reminderId,
        },
        include: {
          event: {
            include: {
              person: true,
            },
          },
        },
      });

    if (!reminder || reminder.completedAt) {
      return;
    }

    await this.prisma.reminderDelivery.createMany({
      data: [
        {
          reminderId,
          channel: ReminderDeliveryChannel.TELEGRAM,
        },
        {
          reminderId,
          channel: ReminderDeliveryChannel.EMAIL,
        },
      ],
      skipDuplicates: true,
    });

    const message = this.buildMessage(reminder);
    const subject =
      `Reminder: ${reminder.event.title}`.slice(0, 200);

    await Promise.all([
      this.processDelivery(
        reminderId,
        ReminderDeliveryChannel.TELEGRAM,
        message,
        subject,
      ),
      this.processDelivery(
        reminderId,
        ReminderDeliveryChannel.EMAIL,
        message,
        subject,
      ),
    ]);

    const unfinished =
      await this.prisma.reminderDelivery.count({
        where: {
          reminderId,
          status: {
            in: [
              ReminderDeliveryStatus.PENDING,
              ReminderDeliveryStatus.PROCESSING,
            ],
          },
        },
      });

    if (unfinished === 0) {
      await this.prisma.reminder.updateMany({
        where: {
          id: reminderId,
          completedAt: null,
        },
        data: {
          completedAt: new Date(),
        },
      });
    }
  }

  private async processDelivery(
    reminderId: string,
    channel: ReminderDeliveryChannel,
    message: string,
    subject: string,
  ): Promise<void> {
    const claimed =
      await this.prisma.reminderDelivery.updateMany({
        where: {
          reminderId,
          channel,
          status: ReminderDeliveryStatus.PENDING,
        },
        data: {
          status: ReminderDeliveryStatus.PROCESSING,
          attemptedAt: new Date(),
          failureReason: null,
        },
      });

    if (claimed.count !== 1) {
      return;
    }

    try {
      const result =
        await this.notificationService.send(
          channel,
          message,
          subject,
        );

      await this.prisma.reminderDelivery.update({
        where: {
          reminderId_channel: {
            reminderId,
            channel,
          },
        },
        data: {
          status: ReminderDeliveryStatus.SENT,
          sentAt: new Date(),
          providerMessageId:
            result.providerMessageId,
          failureReason: null,
        },
      });
    } catch {
      await this.prisma.reminderDelivery.update({
        where: {
          reminderId_channel: {
            reminderId,
            channel,
          },
        },
        data: {
          status: ReminderDeliveryStatus.FAILED,
          failureReason:
            channel === ReminderDeliveryChannel.TELEGRAM
              ? 'Telegram notification failed.'
              : 'Email notification failed.',
        },
      });
    }
  }

  private buildMessage(reminder: {
    event: {
      type: string;
      title: string;
      eventAt: Date | null;
      note: string | null;
      person: {
        firstName: string;
        lastName: string | null;
      };
    };
  }): string {
    const contactName = [
      reminder.event.person.firstName,
      reminder.event.person.lastName,
    ]
      .filter(Boolean)
      .join(' ');

    const lines = [
      'Reminder',
      '',
      `Contact: ${contactName}`,
      `Event: ${reminder.event.title}`,
      `Type: ${reminder.event.type}`,
    ];

    if (reminder.event.eventAt) {
      lines.push(
        `Event date: ${reminder.event.eventAt.toISOString()}`,
      );
    }

    if (reminder.event.note) {
      lines.push(`Note: ${reminder.event.note}`);
    }

    return lines.join('\n');
  }
}
