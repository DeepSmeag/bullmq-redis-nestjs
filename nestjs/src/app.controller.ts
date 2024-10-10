import { Controller, Get, Post, Sse } from '@nestjs/common';
import { AppService, JobRequest } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  @Post()
  createRequest(): JobRequest {
    return this.appService.createRequest();
  }
  @Sse('events')
  sseRequest() {
    return this.appService.sseRequest();
  }
}
