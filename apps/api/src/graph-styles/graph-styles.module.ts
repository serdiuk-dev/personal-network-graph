import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma.module';
import { GraphStylesController } from './graph-styles.controller';
import { GraphStylesService } from './graph-styles.service';

@Module({
  imports: [
    PrismaModule,
  ],
  controllers: [
    GraphStylesController,
  ],
  providers: [
    GraphStylesService,
  ],
})
export class GraphStylesModule {}
