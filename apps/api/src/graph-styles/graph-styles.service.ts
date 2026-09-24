import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service';
import { UpdateGraphStylesDto } from './dto/update-graph-styles.dto';

@Injectable()
export class GraphStylesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  get() {
    return this.prisma.graphStyleSettings.upsert({
      where: {
        id: 1,
      },
      update: {},
      create: {
        id: 1,
      },
    });
  }

  update(data: UpdateGraphStylesDto) {
    return this.prisma.graphStyleSettings.upsert({
      where: {
        id: 1,
      },
      update: data,
      create: {
        id: 1,
        ...data,
      },
    });
  }
}
