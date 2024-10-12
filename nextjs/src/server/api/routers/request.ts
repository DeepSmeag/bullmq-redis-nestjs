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
        yield tracked("NULL", { status: "ERROR" });
        return;
      }
      const { signal } = opts;
      const connection = amqp.connect("amqp://localhost");
      const handleAbort = async () => {
        await connection.close();
      };
      new Promise(() => signal?.addEventListener("abort", handleAbort));
      const exchange = "tasks_exchange";
      const taskEmitter = new TaskEventEmitter();
      try {
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
          void channel
            .consume(queue, (msg) => {
              if (!msg) {
                console.log("Server cancelled this queue", queue);
              } else {
                const statusUpdate = msg.content.toString();
                taskEmitter.emit(opts.input.id!, statusUpdate); // Emit status update
                channel.ack(msg); // Acknowledge the message
              }
            })
            .catch((err) => {
              console.error("Error consuming messages");
            });
        });
        // Yield each status update from the emitter as it comes it
        for await (const statusUpdate of on(taskEmitter, opts.input.id)) {
          const status = statusUpdate[0] as unknown as string;
          yield tracked(opts.input.id, { status });

          if (status === "FINISHED" || status === "ERROR") {
            await connection.close(); // Close the connection
            break; // Exit when the task is finished or errored
          }
        }
      } catch (err) {
        console.log("Error on subscription??");
      } finally {
        taskEmitter.removeAllListeners(opts.input.id); // Clean up the listener
        signal?.removeEventListener("abort", handleAbort);
      }
      //TODO: need to check if solution is viable for multiple clients and does not leak memory over time
      //! Fixed queue staying up after client disconnects by checking msg===null and closing connection
      //TODO: check if the emitters leak memory
      //TODO: apparently the connection is not closed properly so some queues remain up; in reality the situation would not arise because a user would not be able to spam requests like this...but still want to figure it out
      //! UPDATE: fixed the queue leak through the use of the signal event listener for abort
      // for some reason it did not work simply by closing the connection in the finally block...
    }),
});
