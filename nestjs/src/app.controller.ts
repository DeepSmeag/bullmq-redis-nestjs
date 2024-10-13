import { Controller, Post } from '@nestjs/common';
import { AppService, JobRequest } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  @Post()
  createRequest(): JobRequest {
    return this.appService.createRequest();
  }
}
