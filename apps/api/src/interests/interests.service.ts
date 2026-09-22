import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma.service';
import { CreateInterestDto } from './dto/create-interest.dto';
import { UpdateInterestDto } from './dto/update-interest.dto';

@Injectable()
export class InterestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateInterestDto) {
    const existing = await this.prisma.interest.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new ConflictException('Interest already exists');
    }

    return this.prisma.interest.create({ data });
  }

  findAll() {
    return this.prisma.interest.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const interest = await this.prisma.interest.findUnique({
      where: { id },
    });

    if (!interest) {
      throw new NotFoundException(`Interest with id ${id} not found`);
    }

    return interest;
  }

  async update(id: string, data: UpdateInterestDto) {
    await this.findOne(id);

    if (data.name) {
      const existing = await this.prisma.interest.findUnique({
        where: { name: data.name },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Interest already exists');
      }
    }

    return this.prisma.interest.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.interest.delete({
      where: { id },
    });
  }
}
