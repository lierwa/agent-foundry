import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toHttpError } from "../http-errors.js";
import { SessionOrchestrator } from "../session-orchestrator.js";
import { openSse } from "./sse.js";

export function registerSessionRoutes(
  app: FastifyInstance,
  options: {
    sessions: SessionOrchestrator;
  },
) {
  // Session-first API：面向 UI 的会话路由，内部仍委托给 runtime task 流程。
  const { sessions } = options;

  app.post("/sessions", async (request, reply) => {
    try {
      const body = z
        .object({
          packageId: z.string().optional(),
        })
        .parse(request.body ?? {});
      return sessions.createSession(body.packageId ?? "perfume-formulation");
    } catch (error) {
      const httpError = toHttpError(error);
      return reply.code(httpError.statusCode).send(httpError);
    }
  });

  app.get("/sessions/:sessionId", async (request, reply) => {
    const params = z.object({ sessionId: z.string() }).parse(request.params);
    const session = sessions.getSession(params.sessionId);
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }
    return session;
  });

  app.get("/sessions/:sessionId/state", async (request, reply) => {
    const params = z.object({ sessionId: z.string() }).parse(request.params);
    const session = sessions.getSession(params.sessionId);
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }
    return {
      sessionId: session.sessionId,
      task: session.task,
      sessionMemory: session.sessionMemory,
    };
  });

  app.get("/sessions/:sessionId/memory", async (request, reply) => {
    const params = z.object({ sessionId: z.string() }).parse(request.params);
    try {
      return await sessions.getSessionMemory(params.sessionId);
    } catch (error) {
      const httpError = toHttpError(error);
      return reply.code(httpError.statusCode).send(httpError);
    }
  });

  app.get("/sessions/:sessionId/stream", async (request, reply) => {
    const params = z.object({ sessionId: z.string() }).parse(request.params);
    const session = sessions.getSession(params.sessionId);
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }

    openSse(request, reply, {
      eventName: "session",
      onSubscribe: async (send) =>
        sessions.subscribeSession(params.sessionId, (snapshot) => {
          send({ type: "session.snapshot", session: snapshot });
        }),
    });
  });

  app.post("/sessions/:sessionId/messages", async (request, reply) => {
    const params = z.object({ sessionId: z.string() }).parse(request.params);
    const body = z
      .object({
        content: z.string().min(1),
        modelId: z.string().optional(),
      })
      .parse(request.body);

    try {
      return await sessions.submitMessage(params.sessionId, body.content, body.modelId);
    } catch (error) {
      const httpError = toHttpError(error);
      return reply.code(httpError.statusCode).send(httpError);
    }
  });

  app.post("/sessions/:sessionId/approval", async (request, reply) => {
    const params = z.object({ sessionId: z.string() }).parse(request.params);
    const body = z
      .object({
        action: z.enum(["approve", "reject", "revise"]),
        operator: z.string().min(1),
        payload: z.unknown().optional(),
      })
      .parse(request.body);

    try {
      return await sessions.submitApproval(params.sessionId, body.action, body.operator, body.payload);
    } catch (error) {
      const httpError = toHttpError(error);
      return reply.code(httpError.statusCode).send(httpError);
    }
  });
}
