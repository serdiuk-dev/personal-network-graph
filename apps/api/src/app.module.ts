import { Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module';
import { HealthController } from './health.controller';
import { InterestsModule } from './interests/interests.module';
import { PeopleModule } from './people/people.module';
import { PrismaModule } from './prisma.module';
import { RelationshipsModule } from './relationships/relationships.module';

@Module({
  imports: [
    PrismaModule,
    PeopleModule,
    RelationshipsModule,
    CategoriesModule,
    InterestsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
