import type { FastifyInstance } from "fastify";
import type { AgentRuntimeService } from "@agent-foundry/core";
import { createTaskSchema } from "@agent-foundry/shared";
import { z } from "zod";
import { toHttpError } from "../http-errors.js";
import { openSse } from "./sse.js";

export function registerTaskRoutes(
  app: FastifyInstance,
  options: {
    runtime: AgentRuntimeService;
  },
) {
  const { runtime } = options;

  app.get("/tasks", async () => {
    return runtime.listTasks();
  });

  app.get("/tasks/:taskId", async (request, reply) => {
    const params = z.object({ taskId: z.string() }).parse(request.params);
    const task = await runtime.getTask(params.taskId);
    if (!task) {
      return reply.code(404).send({ message: "Task not found" });
    }
    return task;
  });

  app.get("/tasks/:taskId/stream", async (request, reply) => {
    const params = z.object({ taskId: z.string() }).parse(request.params);
    const task = await runtime.getTask(params.taskId);
    if (!task) {
      return reply.code(404).send({ message: "Task not found" });
    }

    openSse(request, reply, {
      eventName: "task",
      onSubscribe: async (send) =>
        runtime.subscribeTask(params.taskId, (nextTask) => {
          send({ type: "task.snapshot", task: nextTask });
        }),
    });
  });

  app.post("/tasks", async (request, reply) => {
    try {
      const payload = createTaskSchema.parse(request.body);
      return await runtime.createTask(payload.packageId, payload.input, payload.modelId);
    } catch (error) {
      const httpError = toHttpError(error);
      return reply.code(httpError.statusCode).send(httpError);
    }
  });

  app.post("/tasks/:taskId/approval", async (request, reply) => {
    const params = z.object({ taskId: z.string() }).parse(request.params);
    const body = z
      .object({
        action: z.enum(["approve", "reject", "revise"]),
        operator: z.string().min(1),
        payload: z.unknown().optional(),
      })
      .parse(request.body);

    try {
      return await runtime.submitApproval(params.taskId, body.action, body.operator, body.payload);
    } catch (error) {
      const httpError = toHttpError(error);
      return reply.code(httpError.statusCode).send(httpError);
    }
  });
}
