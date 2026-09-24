import { Module } from '@nestjs/common';

import { AnalyticsModule } from './analytics/analytics.module';
import { CategoriesModule } from './categories/categories.module';
import { ContactChannelsModule } from './contact-channels/contact-channels.module';
import { GraphModule } from './graph/graph.module';
import { HealthController } from './health.controller';
import { InterestsModule } from './interests/interests.module';
import { PeopleModule } from './people/people.module';
import { PrismaModule } from './prisma.module';
import { RelationshipsModule } from './relationships/relationships.module';
import { MessageRouterModule } from './message-router/message-router.module';

@Module({
  imports: [
    MessageRouterModule,
    PrismaModule,
    PeopleModule,
    RelationshipsModule,
    CategoriesModule,
    ContactChannelsModule,
    InterestsModule,
    GraphModule,
    AnalyticsModule,
  ],
  controllers: [
    HealthController,
  ],
})
export class AppModule {}
