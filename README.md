## A project to exemplify real-time updates with long processing time workers via BullMQ persistent queue with (single-instance) Redis in-memory store

The project is a combination of a mock frontend (NextJS) with a backend (NestJS) that uses BullMQ to queue long-running tasks (simulating db writes and processing via delays). It uses Redis as its store.
