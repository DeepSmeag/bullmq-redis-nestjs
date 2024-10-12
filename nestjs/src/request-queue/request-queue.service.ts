import { Injectable, OnModuleInit } from '@nestjs/common';
import amqp, { ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';

@Injectable()
export class RequestQueueService implements OnModuleInit {
  private channelWrapper: ChannelWrapper;
  constructor() {
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
          console.log('Received message', message.content.toString());
          channel.ack(message);
          const taskID = message.content.toString();
          console.log(`[x] Received task ID ${taskID}`);

          // Simulate sending status updates as the task progresses
          const sendStatusUpdate = (status: string) => {
            channel.publish(exchange, taskID, Buffer.from(status));
            console.log(`[x] Sent status update: ${status}`);
          };

          // Simulate task execution
          console.log(`Sending WAITING for ${taskID}`);
          sendStatusUpdate('WAITING');

          setTimeout(() => {
            console.log(`Sending IN PROGRESS for ${taskID}`);
            sendStatusUpdate('IN PROGRESS');

            // Simulate a 3-5 second delay
            const delay = Math.floor(Math.random() * 3000) + 3000;
            setTimeout(() => {
              const finalStatus = Math.random() > 0.5 ? 'FINISHED' : 'ERROR';
              console.log(`Sending ${finalStatus} for ${taskID}`);
              sendStatusUpdate(finalStatus);
            }, delay);
          }, 1000);
        });
      });
    } catch (err) {
      console.error(err);
    } finally {
      console.log('Consumer ready');
    }
  }
  public async publishStatusUpdate(taskID: string) {
    await this.channelWrapper.publish(
      'tasks_exchange',
      'worker_queue',
      Buffer.from(taskID),
    );
    console.log(`Published taskID ${taskID}`);
  }
}
