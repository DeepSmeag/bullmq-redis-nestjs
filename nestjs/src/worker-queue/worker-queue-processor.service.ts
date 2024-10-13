import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { JobRequest } from 'src/app.service';
import { RequestQueueService } from 'src/request-queue/request-queue.service';

@Processor('jobqueue', { concurrency: 1 })
export class WorkerQueueProcessorService extends WorkerHost {
  constructor(private requestQueueService: RequestQueueService) {
    super();
  }
  process(
    job: Job<JobRequest, JobRequest, string>,
    token?: string,
  ): Promise<any> {
    const taskID = job.data.id;
    const finalStatus = Math.random() > 0.5 ? 'FINISHED' : 'ERROR';
    const randWait = Math.floor(Math.random() * 3000) + 3000;
    console.log(
      `[x] WorkerQueue: Received task ID ${taskID} with token ${token}; waiting ${randWait}ms`,
    );

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (finalStatus === 'FINISHED') {
          const finishedJob = job.data;
          finishedJob.status = 'FINISHED';
          resolve(finishedJob);
        } else {
          reject(new Error('Task failed'));
        }
      }, randWait);
    });
  }
  @OnWorkerEvent('active')
  async onActive(job: Job<JobRequest, JobRequest, string>) {
    console.log(`Job ${job.id} active`);
    // IN PROGRESS
    await this.requestQueueService.publishStatusUpdate(
      job.data.id,
      'IN PROGRESS',
    );
  }
  @OnWorkerEvent('completed')
  async onCompleted(job: Job<JobRequest, JobRequest, string>) {
    console.log(`Job ${job.id} completed`);
    // FINISHED
    await this.requestQueueService.publishStatusUpdate(job.data.id, 'FINISHED');
  }
  @OnWorkerEvent('error')
  async onError(job: Job<JobRequest, JobRequest, string>) {
    console.log(`Job ${job.id} error`);
    // ERROR
    await this.requestQueueService.publishStatusUpdate(job.data.id, 'ERROR');
  }
  @OnWorkerEvent('paused')
  async onPaused(job: Job<JobRequest, JobRequest, string>) {
    console.log(`Job ${job.id} paused`);
    //WAITING
    await this.requestQueueService.publishStatusUpdate(job.data.id, 'WAITING');
  }
}
