import { Injectable } from '@nestjs/common';
import { interval, map, Observable } from 'rxjs';
export type JobRequest = {
  id: string;
  status: 'WAITING' | 'IN PROGRESS' | 'FINISHED' | 'ERROR';
};

@Injectable()
export class AppService {
  // temporary array of requests
  requests: JobRequest[] = [];

  getHello(): string {
    return JSON.stringify(this.requests);
  }
  createRequest(): JobRequest {
    const lastRequest = this.requests[this.requests.length - 1];
    const newRequest: JobRequest = {
      id: lastRequest ? String(Number(lastRequest.id) + 1) : '1',
      status: 'WAITING',
    };
    this.requests.push(newRequest);
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
