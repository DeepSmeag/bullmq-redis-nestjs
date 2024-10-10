import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { zAsyncGenerator } from "../zAsyncGenerator";
import { tracked } from "@trpc/server";
import EventEmitter from "events";

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
      try {
        if (opts.input.id === null) {
          return;
        }
        const { reader, status } = await sseRequest(opts.input.id);
        if (!reader) {
          yield tracked("error", { status: "ERROR" });
          return;
        }

        try {
          //TODO: need to cleanup connection to stop it continuing after client disconnects from subscription
          let streamActive = true;
          const textDecoder = new TextDecoder();
          while (streamActive) {
            const { done, value } = await reader.read();
            if (done) {
              streamActive = false;
              continue;
            }
            const chunk = textDecoder.decode(value);
            const lines = chunk.trim().split("\n");
            for (const line of lines) {
              if (line.startsWith("data:")) {
                const data = JSON.parse(line.slice(5)) as {
                  status: string;
                }; // eliminating 'data:'
                console.log(data);
                yield tracked("whatever", { status: data.status });

                if (data.status === "FINISHED" || data.status === "ERROR") {
                  streamActive = false;
                  await reader.cancel();
                  break;
                }
              }
            }
          }
        } finally {
          console.log("Aborted with reader");
          await reader.cancel();
        }
      } finally {
        console.log("Aborted");
      }

      // for complete safety, we would need to add a ReadableStream or another way of catching events the client might have missed in a sudden disconnect

      // while (index < 5) {
      //   index++;
      //   yield tracked(index.toString(), { status: "IN PROGRESS" });
      //   await new Promise((resolve) => setTimeout(resolve, 1000));
      // }
      // // random number generate
      // const random = Math.random();
      // if (random < 0.5) {
      //   yield tracked(index.toString(), { status: "ERROR" });
      //   return;
      // }
      // yield tracked(index.toString(), { status: "FINISHED" });
    }),
});
