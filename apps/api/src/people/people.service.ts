import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensurePersonExists(id: string) {
    const person = await this.prisma.person.findUnique({
      where: { id },
    });

    if (!person) {
      throw new NotFoundException(`Person with id ${id} not found`);
    }

    return person;
  }

  create(data: CreatePersonDto) {
    return this.prisma.person.create({
      data,
    });
  }

  findAll() {
    return this.prisma.person.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const person = await this.prisma.person.findUnique({
      where: { id },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
        interests: {
          include: {
            interest: true,
          },
        },
      },
    });

    if (!person) {
      throw new NotFoundException(`Person with id ${id} not found`);
    }

    return {
      ...person,
      categories: person.categories.map((item) => item.category),
      interests: person.interests.map((item) => item.interest),
    };
  }

  async update(id: string, data: UpdatePersonDto) {
    await this.ensurePersonExists(id);

    return this.prisma.person.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.ensurePersonExists(id);

    return this.prisma.person.delete({
      where: { id },
    });
  }

  async addCategory(personId: string, categoryId: string) {
    await this.ensurePersonExists(personId);

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(
        `Category with id ${categoryId} not found`,
      );
    }

    const existing = await this.prisma.personCategory.findUnique({
      where: {
        personId_categoryId: {
          personId,
          categoryId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Category is already assigned to this person',
      );
    }

    return this.prisma.personCategory.create({
      data: {
        personId,
        categoryId,
      },
      include: {
        category: true,
      },
    });
  }

  async removeCategory(personId: string, categoryId: string) {
    await this.ensurePersonExists(personId);

    const existing = await this.prisma.personCategory.findUnique({
      where: {
        personId_categoryId: {
          personId,
          categoryId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(
        'Category is not assigned to this person',
      );
    }

    return this.prisma.personCategory.delete({
      where: {
        personId_categoryId: {
          personId,
          categoryId,
        },
      },
    });
  }

  async addInterest(personId: string, interestId: string) {
    await this.ensurePersonExists(personId);

    const interest = await this.prisma.interest.findUnique({
      where: { id: interestId },
    });

    if (!interest) {
      throw new NotFoundException(
        `Interest with id ${interestId} not found`,
      );
    }

    const existing = await this.prisma.personInterest.findUnique({
      where: {
        personId_interestId: {
          personId,
          interestId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Interest is already assigned to this person',
      );
    }

    return this.prisma.personInterest.create({
      data: {
        personId,
        interestId,
      },
      include: {
        interest: true,
      },
    });
  }

  async removeInterest(personId: string, interestId: string) {
    await this.ensurePersonExists(personId);

    const existing = await this.prisma.personInterest.findUnique({
      where: {
        personId_interestId: {
          personId,
          interestId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(
        'Interest is not assigned to this person',
      );
    }

    return this.prisma.personInterest.delete({
      where: {
        personId_interestId: {
          personId,
          interestId,
        },
      },
    });
  }
}
