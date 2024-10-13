import { Injectable } from '@nestjs/common';
import { interval, map, Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { RequestQueueService } from './request-queue/request-queue.service';
export type JobRequest = {
  id: string;
  status: 'NOT STARTED' | 'WAITING' | 'IN PROGRESS' | 'FINISHED' | 'ERROR';
};

@Injectable()
export class AppService {
  constructor(private readonly requestQueueService: RequestQueueService) {}

  createRequest(): JobRequest {
    const newRequest: JobRequest = {
      id: uuidv4(),
      status: 'NOT STARTED',
    };
    setTimeout(() => {
      this.requestQueueService.publishTask(newRequest.id);
    }, 200);
    return newRequest;
  }
}
