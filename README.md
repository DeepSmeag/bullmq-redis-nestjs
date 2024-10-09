## A project to exemplify real-time updates with long processing time workers via BullMQ persistent queue with (single-instance) Redis in-memory store

The project is a combination of a mock frontend (NextJS) with a backend (NestJS) that uses BullMQ to queue long-running tasks (simulating db writes and processing via delays). It uses Redis as its store.  

The flow is as follows:
- UI has text for current state of running task (WAITING, IN PROGRESS, FINISHED, CANCELLED, ERROR) + button to launch task
- on button press NextJS frontend notifies NextJS backend; NextJS backend talks to NestJS backend  
(why this decision) normally it's not advisable to introduce extra steps; for this use-case, I simulate a situation where we use NextJS as user-facing business logic and Nestjs as a separate backend for more complex operations, like long-running tasks which we simulate here; so in this situation it's preferrable not to expose NestJS to the client  
extra note: in a real project guards for who accesses the NestJS API would be necessary, along with entire pipelines for input validation / transformation and error handling;  

- the NextJS backend sends request to NestJS to create a long-running task; it receives its ID and current state (WAITING) which is then given back to the client;
- the client initiates a websocket connection to the NextJS backend to listen for updates to the task (currently implementing this via tRPC's subscribe hooks)
- the NextJS backend also initiates a websocket connection to listen for updates from the NestJS backend
- in the meantime, when the task request was received, the NestJS backend adds a job to the queue
- (when the job starts it sets the task status to IN PROGRESS) the job simulates a long-running process by generating a number 1-10 to use for a delay (s); at the end it sets the task status to FINISHED
- there is a 1 in 10 chance (randomly generate number) to throw an error; in this situation, the job ends without retrying and the status is set to ERROR  
(note) generally, having a retry strategy would be the case; in this situation it's not relevant
- once a finishing status is received on the client (FINISHED/ERROR), the websocket is closed
