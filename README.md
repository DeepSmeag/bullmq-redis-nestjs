## A project to exemplify real-time updates with long processing time workers via BullMQ persistent queue with (single-instance) Redis in-memory store

Used: RabbitMQ + Redis (I ran them via docker), Nextjs(+trpc), Nestjs  
The project is a combination of a mock fullstack (NextJS) with a backend (NestJS) that uses RabbitMQ for receiving updates about long-running tasks which execute async, are persistent, and permit retries if we need it (BullMQ to queue them internally; simulating long processing via delays). BullMQ uses Redis under the hood. The goal is to be able to decouple components as much as possible, ensuring horizontal scalability and robustness with the persistence aspect of the queues.



The flow is as follows:
- UI has text for current state of running task (NOT STARTED, WAITING, IN PROGRESS, FINISHED, ERROR) + button to launch task + the task's id, as a small debugging indicator
- on button press NextJS frontend notifies NextJS backend; NextJS backend talks to NestJS backend  
  - (why this decision) normally it's not advisable to introduce extra steps; for this use-case, I simulate a situation where we use NextJS as user-facing business logic and Nestjs as a separate backend for more complex operations, like long-running tasks which we simulate here; so in this situation it's preferrable not to expose NestJS to the client; you can consider it a microservice simulation;  
extra note: in a real project guards for who accesses the NestJS API would be necessary, along with entire pipelines for input validation / transformation and error handling;  
  - (on button press) the NextJS backend sends a request to NestJS to create a long-running task and gets the task id and status as a response;
  - in the meantime, Nestjs publishes this task to a RabbitMQ queue and it's picked up by a RabbitMQ consumer (still Nestjs);
  - the RabbitMQ Nestjs consumer sends the task as a job to the BullMQ internal queue, which starts processing the task via its workers (simulating some work with a timeout)
- after receiving the task from the initial request, the client initiates a SSE connection to the NextJS backend to listen for updates to the task (implemented via tRPC's useSubscription hook + httpSubscription terminating link)
  - this connection stops when an ending status is given (FINISHED/ERROR)
  - alternatively, random disconnections can occur as well; trpc reconnects automatically; we need to make sure we close our resources properly
- the NextJS backend initiates a RabbitMQ consumer inside its subscription, which is used to emit events via an EventEmitter which is then listened to so we can send the updates to the client


### A system design situation to consider

- the goal of the project is to simulate situations where a client would trigger a long-running task and it would need to be updated on its situation; these tasks are processed asynchronously, and there is no guarantee that a server can start processing immediately (maybe it's down, maybe it's busy with other jobs)
- infrastructure-wise, the code should accomodate the potential for a distributed system, with multiple instances of the backends running at once
- the decision to use a message queue for inter-server communication & updates meets both requirements for scalability and robustness
- the decision to send the RabbitMQ message from Nestjs to a Nestjs consumer is unnecessary, though it is a learning experience; in a real application, I would directly publish it to the internal BullMQ job queue
  - this is because the server has already been notified of the request creation via the POST request; it does not need an extra signal; so the RabbitMQ consumer on Nestjs is unnecessary; an important assumption is that in a scalable environment we would have a load balancer in front of the Nestjs instances to distribute requests across them
  - a situation in which it would make sense to have the Nestjs side (read "microservice") consuming the queue would be one in which we don't have a way of direct communication with it, so it's completely decoupled from the rest of the system (a situation in which we would not be calling Nestjs to create our task)
- so I've implemented some unnecessary communication, but it's good practice either way

### Some scaling & other issues to consider  

- if the system is distributed via load balancer with multiple servers, does it still work?
  - HTTP requests & responses work as normal
  - given the way RabbitMQ works, the system can safely handle request distribution & updates sending across many instances; BullMQ + Redis are used internally so each Nestjs instance gets its own cache in a way
  - what does not entirely scale, however, is Nextjs; given its ISR, caching and other mechanisms which need proper configuration, simply starting multiple instances is not enough for true horizontal scaling
- does the client update get sent to the right client and only that client?
  - since the clients subscribe to their specific taskID, it is ensured that each client gets only their updates
- is memory correctly handled and connections properly closed?
  - I tested the application with a few local Nextjs processes and multiple clients and spamming buttons; it's not the most scientific setup, but I could at least verify some things:
  - connections are properly closed, which is observed through the disappearance of all temporary RabbitMQ queues; this means there's no listening being done on queues which have been disconnected (the client left/they got their response)
  - memory does not seem to leak over time; based on [this heap profiling approach](https://msmechatronics.medium.com/nextjs-performance-mysteries-unmasking-memory-leaks-3696cf22564b), I measured process memory consumption with tens of clients connected, requesting multiple times, staying connected and then leaving; heap profiling shows no significant changes
  - process memory (via _htop_) increases by spamming buttons; after a while (after the client disconnected) it drops back, indicating there has been some caching being done for a while which was later cleared
 
### Overall / summary

- a good project to force some system design thinking, keep scalability in mind and robustness upon server failure
- also a common use-case for larger application with more demanding tasks that take a while to process and need to be done async, but we still want to have updates on their situation without manually polling
- I would recommend using persistent queues (RabbitMQ most configurable I'd say, BullMQ if using Nestjs and want some job queue solution) in all situations where async, decoupled execution is needed; it scales nicely as well, with a single RabbitMQ instance being able to serve 32000 concurrent queues (where each queue could be attached to 1 or more server instances) easily, based on some searches
- microservices would most likely require persistent queue mechanisms
