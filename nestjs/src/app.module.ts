import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { RequestQueueModule } from './request-queue/request-queue.module';

@Module({
  imports: [RequestQueueModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
