import {
  Controller,
  Get,
} from '@nestjs/common';

import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get('network')
  getNetworkAnalytics() {
    return this.analyticsService.getNetworkAnalytics();
  }
}
