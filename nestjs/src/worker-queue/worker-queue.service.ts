import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { JobRequest } from 'src/app.service';

@Injectable()
export class WorkerQueueService {
  constructor(@InjectQueue('jobqueue') private readonly jobqueue: Queue) {}
  async publishJob(job: JobRequest) {
    await this.jobqueue.add('process', job);
  }
}
