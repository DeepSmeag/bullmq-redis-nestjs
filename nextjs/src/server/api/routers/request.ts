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
      // const sendUpdate = (status: string) => {
      //   yield tracked(opts.input.id!, { status });}
      // ee.on(opts.input.id, (data: { status: string }) => {
      //   sendUpdate(data.status);
      // });
      let index = opts.input.lastEventId ?? 0;
      // for complete safety, we would need to add a ReadableStream or another way of catching events the client might have missed in a sudden disconnect

      while (index < 5) {
        index++;
        yield tracked(index.toString(), { status: "IN PROGRESS" });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      // random number generate
      const random = Math.random();
      if (random < 0.5) {
        yield tracked(index.toString(), { status: "ERROR" });
        return;
      }
      yield tracked(index.toString(), { status: "FINISHED" });
    }),
});
