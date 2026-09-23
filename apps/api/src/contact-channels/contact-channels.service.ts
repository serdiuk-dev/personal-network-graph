import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma.service';
import { CreateContactChannelDto } from './dto/create-contact-channel.dto';
import { UpdateContactChannelDto } from './dto/update-contact-channel.dto';

@Injectable()
export class ContactChannelsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private async ensurePersonExists(
    personId: string,
  ) {
    const person =
      await this.prisma.person.findUnique({
        where: {
          id: personId,
        },
        select: {
          id: true,
        },
      });

    if (!person) {
      throw new NotFoundException(
        `Person with id ${personId} not found`,
      );
    }
  }

  async findForPerson(
    personId: string,
  ) {
    await this.ensurePersonExists(
      personId,
    );

    return this.prisma.contactChannel.findMany({
      where: {
        personId,
      },
      orderBy: [
        {
          isPreferred: 'desc',
        },
        {
          platform: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });
  }

  async findOne(id: string) {
    const channel =
      await this.prisma.contactChannel.findUnique({
        where: {
          id,
        },
      });

    if (!channel) {
      throw new NotFoundException(
        `Contact channel with id ${id} not found`,
      );
    }

    return channel;
  }

  async create(
    personId: string,
    data: CreateContactChannelDto,
  ) {
    await this.ensurePersonExists(
      personId,
    );

    if (data.isPreferred === true) {
      return this.prisma.$transaction(
        async (tx) => {
          await tx.contactChannel.updateMany({
            where: {
              personId,
              isPreferred: true,
            },
            data: {
              isPreferred: false,
            },
          });

          return tx.contactChannel.create({
            data: {
              personId,
              ...data,
            },
          });
        },
      );
    }

    return this.prisma.contactChannel.create({
      data: {
        personId,
        ...data,
      },
    });
  }

  async update(
    id: string,
    data: UpdateContactChannelDto,
  ) {
    const existing =
      await this.findOne(id);

    if (data.isPreferred === true) {
      return this.prisma.$transaction(
        async (tx) => {
          await tx.contactChannel.updateMany({
            where: {
              personId:
                existing.personId,
              isPreferred: true,
              NOT: {
                id,
              },
            },
            data: {
              isPreferred: false,
            },
          });

          return tx.contactChannel.update({
            where: {
              id,
            },
            data,
          });
        },
      );
    }

    return this.prisma.contactChannel.update({
      where: {
        id,
      },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.contactChannel.delete({
      where: {
        id,
      },
    });
  }
}
