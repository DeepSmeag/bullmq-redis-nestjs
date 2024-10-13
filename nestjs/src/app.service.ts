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
  // temporary array of requests
  requests: JobRequest[] = [];

  getHello(): string {
    return JSON.stringify(this.requests);
  }

  createRequest(): JobRequest {
    const newRequest: JobRequest = {
      id: uuidv4(),
      status: 'NOT STARTED',
    };
    this.requests.push(newRequest);
    setTimeout(() => {
      this.requestQueueService.publishTask(newRequest.id);
    }, 200);
    return newRequest;
  }
  sseRequest(): Observable<MessageEvent> {
    // choose a random status between the 4 possible
    // ugly, but it's a temporary mock
    // we have doubles to increase chance of waiting and in progress
    return interval(1000).pipe(
      map(
        () =>
          ({
            data: {
              status: [
                'WAITING',
                'WAITING',
                'IN PROGRESS',
                'IN PROGRESS',
                'IN PROGRESS',
                'IN PROGRESS',
                'IN PROGRESS',
                'IN PROGRESS',
                'FINISHED',
                'ERROR',
              ][Math.floor(Math.random() * 10)],
            },
          }) as MessageEvent,
      ),
    );
  }
}
