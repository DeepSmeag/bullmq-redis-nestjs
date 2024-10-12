import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RequestQueueService } from './request-queue/request-queue.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, RequestQueueService],
})
export class AppModule {}
