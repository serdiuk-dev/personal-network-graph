import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PeopleModule } from './people/people.module';
import { PrismaModule } from './prisma.module';
import { RelationshipsModule } from './relationships/relationships.module';

@Module({
  imports: [
    PrismaModule,
    PeopleModule,
    RelationshipsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
