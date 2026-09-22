import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma.service';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { UpdateRelationshipDto } from './dto/update-relationship.dto';

@Injectable()
export class RelationshipsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensurePersonExists(id: string) {
    const person = await this.prisma.person.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!person) {
      throw new BadRequestException(`Person with id ${id} does not exist`);
    }
  }

  private ensureNotSelfRelationship(fromId: string, toId: string) {
    if (fromId === toId) {
      throw new BadRequestException(
        'A person cannot have a relationship with themselves',
      );
    }
  }

  private async ensureUniqueRelationship(
    fromId: string,
    toId: string,
    excludeId?: string,
  ) {
    const relationship = await this.prisma.relationship.findFirst({
      where: {
        fromId,
        toId,
        ...(excludeId
          ? {
              id: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: { id: true },
    });

    if (relationship) {
      throw new ConflictException(
        'Relationship between these people already exists',
      );
    }
  }

  async create(data: CreateRelationshipDto) {
    this.ensureNotSelfRelationship(data.fromId, data.toId);

    await this.ensurePersonExists(data.fromId);
    await this.ensurePersonExists(data.toId);
    await this.ensureUniqueRelationship(data.fromId, data.toId);

    return this.prisma.relationship.create({
      data,
    });
  }

  findAll() {
    return this.prisma.relationship.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const relationship = await this.prisma.relationship.findUnique({
      where: { id },
    });

    if (!relationship) {
      throw new NotFoundException(
        `Relationship with id ${id} not found`,
      );
    }

    return relationship;
  }

  async update(id: string, data: UpdateRelationshipDto) {
    const current = await this.findOne(id);

    const fromId = data.fromId ?? current.fromId;
    const toId = data.toId ?? current.toId;

    this.ensureNotSelfRelationship(fromId, toId);

    await this.ensurePersonExists(fromId);
    await this.ensurePersonExists(toId);
    await this.ensureUniqueRelationship(fromId, toId, id);

    return this.prisma.relationship.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.relationship.delete({
      where: { id },
    });
  }
}
