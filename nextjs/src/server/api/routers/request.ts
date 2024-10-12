import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { zAsyncGenerator } from "../zAsyncGenerator";
import { tracked } from "@trpc/server";
import EventEmitter, { on } from "events";
import { type ConfirmChannel } from "amqplib";
import amqp, { type ChannelWrapper } from "amqp-connection-manager";

// In a real app, you'd probably use Redis or something
class TaskEventEmitter extends EventEmitter {}

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
      try {
        const taskEmitter = new TaskEventEmitter();
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
          // Consume messages and emit status updates
          void channel.consume(queue, (msg) => {
            if (!msg) {
              console.log("Server cancelled this queue", queue);
              connection.close();
            } else {
              const statusUpdate = msg.content.toString();
              console.log("Received status update", statusUpdate);
              taskEmitter.emit(opts.input.id!, statusUpdate); // Emit status update
              channel.ack(msg); // Acknowledge the message
            }
          });
        });
        // Listen to task updates using the EventEmitter
        const taskListener = (status: string) => {
          taskEmitter.emit("status", status); // Emit status updates
        };

        // Listen for task updates
        taskEmitter.on(opts.input.id, taskListener);
        console.log("Subscribed to task updates");
        // Consume messages from RabbitMQ and yield updates
        // Yield each status update as it comes in
        for await (const statusUpdate of on(taskEmitter, "status")) {
          const status = statusUpdate[0] as unknown as string;
          console.log("Yielding status update", status);
          yield tracked(opts.input.id, { status });

          if (status === "FINISHED" || status === "ERROR") {
            taskEmitter.removeListener(opts.input.id, taskListener); // Clean up the listener
            await connection.close(); // Close the connection
            break; // Exit when the task is finished or errored
          }
        }
      } finally {
        await connection.close();
      }

      //TODO: need to check if solution is viable for multiple clients and does not leak memory over time
      //! Fixed queue staying up after client disconnects by checking msg===null and closing connection
      //TODO: check if the emitters leak memory
    }),
});
