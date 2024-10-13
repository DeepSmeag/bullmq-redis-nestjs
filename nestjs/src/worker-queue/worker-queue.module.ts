import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkerQueueService } from './worker-queue.service';
import { WorkerQueueProcessorService } from './worker-queue-processor.service';
import { RequestQueueService } from 'src/request-queue/request-queue.service';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'jobqueue',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
        delay: 500,
      },
    }),
  ],
  providers: [
    WorkerQueueService,
    WorkerQueueProcessorService,
    RequestQueueService,
  ],
  exports: [WorkerQueueService],
})
export class WorkerQueueModule {}
