import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import amqp, { ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import { WorkerQueueService } from 'src/worker-queue/worker-queue.service';

@Injectable()
export class RequestQueueService implements OnModuleInit {
  private channelWrapper: ChannelWrapper;
  constructor(
    @Inject() private readonly workerQueueService: WorkerQueueService,
  ) {
    const connection = amqp.connect(['amqp://localhost']);
    this.channelWrapper = connection.createChannel({
      setup: () => {
        console.log('Reconnected channel');
      },
    });
  }
  async onModuleInit() {
    try {
      const exchange = 'tasks_exchange';
      const queue = 'worker_queue';
      await this.channelWrapper.addSetup(async (channel: ConfirmChannel) => {
        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queue, { durable: true });
        await channel.bindQueue(queue, exchange, 'worker_queue');
        await channel.consume(queue, async (message) => {
          // console.log('Received message', message.content.toString());
          await this.workerQueueService.publishJob({
            id: message.content.toString(),
            status: 'NOT STARTED',
          });
          channel.ack(message);
          await this.publishStatusUpdate(message.content.toString(), 'WAITING');
        });
      });
    } catch (err) {
      console.error(err);
    } finally {
      console.log('Consumer ready');
    }
  }
  public async publishTask(taskID: string) {
    await this.channelWrapper.publish(
      'tasks_exchange',
      'worker_queue',
      Buffer.from(taskID),
    );
    // console.log(`Published taskID ${taskID}`);
  }
  public async publishStatusUpdate(taskID: string, status: string) {
    await this.channelWrapper.publish(
      'tasks_exchange',
      taskID,
      Buffer.from(status),
    );
    // console.log(`Published status update for ${taskID}: ${status}`);
  }
}
