import { Controller, Get } from '@nestjs/common';
import { GraphService } from './graph.service';

@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get()
  getGraph() {
    return this.graphService.getGraph();
  }
}
