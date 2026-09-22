import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma.module';
import { PeopleModule } from './people/people.module';

@Module({
  imports: [PrismaModule, PeopleModule],
  controllers: [HealthController],
})
export class AppModule {}
