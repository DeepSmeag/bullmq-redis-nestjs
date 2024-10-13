import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { JobRequest } from 'src/app.service';
import { RequestQueueService } from 'src/request-queue/request-queue.service';

@Processor('jobqueue', { concurrency: 5 })
export class WorkerQueueProcessorService extends WorkerHost {
  constructor(private requestQueueService: RequestQueueService) {
    super();
  }
  process(job: Job<JobRequest, JobRequest, string>): Promise<any> {
    // const taskID = job.data.id;
    const finalStatus = Math.random() > 0.5 ? 'FINISHED' : 'ERROR';
    const randWait = Math.floor(Math.random() * 3000) + 3000;
    // console.log(
    //   `[x] WorkerQueue: Received task ID ${taskID} with token ${token}; waiting ${randWait}ms`,
    // );
    // if (finalStatus === 'ERROR') {
    //   throw new Error('Task failed');
    // }
    //! If I throw error here, the 'failed' event will be triggered
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (finalStatus === 'FINISHED') {
          const finishedJob = job.data;
          finishedJob.status = 'FINISHED';
          resolve(finishedJob);
        } else {
          //! If I throw error here, the Nestjs runtime throws an error
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
    //! This event is triggered when the worker itself has unhandled errors; not related to my code
    // ERROR
    await this.requestQueueService.publishStatusUpdate(job.data.id, 'ERROR');
  }
  @OnWorkerEvent('paused')
  async onPaused(job: Job<JobRequest, JobRequest, string>) {
    console.log(`Job ${job.id} paused`);
    //WAITING
    await this.requestQueueService.publishStatusUpdate(job.data.id, 'WAITING');
  }
  @OnWorkerEvent('stalled')
  async onStalled(job: Job<JobRequest, JobRequest, string>) {
    console.log(`Job ${job.id} stalled`);
    //WAITING
    await this.requestQueueService.publishStatusUpdate(job.data.id, 'WAITING');
  }
  @OnWorkerEvent('failed')
  async onFailed(job: Job<JobRequest, JobRequest, string>) {
    console.log(`Job ${job.id} failed`);
    //! This is the event that is triggered when the job fails via the throw new Error('Task failed') or reject()
    //ERROR
    await this.requestQueueService.publishStatusUpdate(job.data.id, 'ERROR');
  }
}
