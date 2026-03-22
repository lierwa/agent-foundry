import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { createRuntimeServices, type AgentRuntimeService } from "@agent-foundry/core";
import { createTaskSchema } from "@agent-foundry/shared";
import { perfumeAgentPackage } from "../../../packages/agents/perfume/src/index.js";

export interface BuildAppOptions {
  runtime?: AgentRuntimeService;
  logger?: boolean | FastifyBaseLogger;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const runtime =
    options.runtime ??
    createRuntimeServices({
      packages: [perfumeAgentPackage],
    });

  const app = Fastify({
    logger: options.logger ?? false,
  });

  void app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => ({
    ok: true,
  }));

  app.get("/packages", async () => {
    return runtime.listPackages().map((pkg) => ({
      id: pkg.id,
      version: pkg.version,
      title: pkg.title,
      description: pkg.description,
      approvalPolicy: pkg.approvalPolicy,
    }));
  });

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

  app.post("/tasks", async (request) => {
    const payload = createTaskSchema.parse(request.body);
    return runtime.createTask(payload.packageId, payload.input);
  });

  app.post("/tasks/:taskId/approval", async (request, reply) => {
    const params = z.object({ taskId: z.string() }).parse(request.params);
    const body = z.object({
      action: z.enum(["approve", "reject", "revise"]),
      operator: z.string().min(1),
      payload: z.unknown().optional(),
    }).parse(request.body);

    try {
      return await runtime.submitApproval(params.taskId, body.action, body.operator, body.payload);
    } catch (error) {
      return reply.code(400).send({
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return app;
}
