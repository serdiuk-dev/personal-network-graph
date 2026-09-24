import {
  Body,
  Controller,
  Get,
  Patch,
} from '@nestjs/common';

import { UpdateGraphStylesDto } from './dto/update-graph-styles.dto';
import { GraphStylesService } from './graph-styles.service';

@Controller('graph-styles')
export class GraphStylesController {
  constructor(
    private readonly graphStylesService:
      GraphStylesService,
  ) {}

  @Get()
  get() {
    return this.graphStylesService.get();
  }

  @Patch()
  update(
    @Body() data: UpdateGraphStylesDto,
  ) {
    return this.graphStylesService.update(
      data,
    );
  }
}
