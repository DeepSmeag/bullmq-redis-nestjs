/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { zAsyncGenerator } from "../zAsyncGenerator";
import { tracked } from "@trpc/server";
import EventEmitter from "events";
import { type ConfirmChannel } from "amqplib";
import amqp, { type ChannelWrapper } from "amqp-connection-manager";

// In a real app, you'd probably use Redis or something
export const ee = new EventEmitter();
export type JobRequest = {
  id: string;
  status: "WAITING" | "IN PROGRESS" | "FINISHED" | "ERROR";
};
async function sseRequest(id: string) {
  const sseurl = "http://localhost:3002/events";
  const response = await fetch(sseurl, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
    },
  });
  if (!response.body) {
    return {
      status: "ERROR",
      reader: null,
    };
  }
  const reader = response.body.getReader();
  return { reader: reader, status: "WAITING" };
}

export const requestRouter = createTRPCRouter({
  sendRequest: publicProcedure.mutation(async () => {
    // simulate a call to the NestJS backend that returns a Request object with id and status
    const response = await fetch("http://localhost:3002", { method: "POST" });
    const request: JobRequest = (await response.json()) as JobRequest;
    return request;
  }),

  subscribeToRequest: publicProcedure
    .input(
      z.object({
        id: z.string().nullable(),
        lastEventId: z.coerce.number().min(0).optional(), // do I need this?
      }),
    )
    .output(
      zAsyncGenerator({
        yield: z.object({
          status: z.string(),
        }),
        tracked: true,
      }),
    )
    .subscription(async function* (opts) {
      if (opts.input.id === null) {
        return;
      }
      const connection = amqp.connect("amqp://localhost");
      const exchange = "tasks_exchange";
      const channel: ChannelWrapper = connection.createChannel();
      let queue: string;
      await channel.addSetup(async (ch: ConfirmChannel) => {
        await ch.assertExchange(exchange, "direct", { durable: true });
        const queueObject = await channel.assertQueue("", {
          exclusive: true,
        });
        queue = queueObject.queue;
        await channel
          .bindQueue(queue, exchange, opts.input.id!)
          .catch((err) => {
            console.error("Error binding queue to exchange");
          });
      });

      try {
        // Consume messages from RabbitMQ and yield updates
        while (true) {
          const statusUpdate = await new Promise<string>((resolve, reject) => {
            void channel.consume(
              queue,
              (msg) => {
                if (msg !== null) {
                  const statusUpdate = msg.content.toString();
                  channel.ack(msg); // Acknowledge the message
                  resolve(statusUpdate);
                }
              },
              { noAck: false }, // Requires acknowledgement
            );
          });

          // Yield the status update
          yield tracked(opts.input.id, { status: statusUpdate });

          // Close the connection if the task is finished or errored
          if (statusUpdate === "FINISHED" || statusUpdate === "ERROR") {
            await connection.close();
            break;
          }
        }
      } finally {
        await connection.close();
      }
    }),
});
