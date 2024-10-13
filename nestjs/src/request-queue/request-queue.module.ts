import { Global, Module } from '@nestjs/common';

import { RequestQueueService } from './request-queue.service';
import { WorkerQueueModule } from 'src/worker-queue/worker-queue.module';

@Global()
@Module({
  imports: [WorkerQueueModule],
  controllers: [],
  providers: [RequestQueueService],
  exports: [RequestQueueService],
})
export class RequestQueueModule {}
