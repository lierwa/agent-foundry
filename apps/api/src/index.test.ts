import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

const apps: FastifyInstance[] = [];

async function createApp(): Promise<FastifyInstance> {
  const app = buildApp();
  apps.push(app);
  await app.ready();
  return app;
}

async function waitForTask(app: FastifyInstance, taskId: string, predicate: (status: string) => boolean) {
  const deadline = Date.now() + 3000;

  while (Date.now() < deadline) {
    const response = await app.inject({
      method: "GET",
      url: `/tasks/${taskId}`,
    });
    const payload = response.json();
    if (predicate(payload.status)) {
      return payload;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  const response = await app.inject({
    method: "GET",
    url: `/tasks/${taskId}`,
  });
  return response.json();
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("API routes", () => {
  it("responds to /health", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("lists registered packages", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "GET",
      url: "/packages",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "perfume-formulation",
          title: "Perfume Intention Agent",
        }),
      ]),
    );
  });

  it("lists configured models", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "GET",
      url: "/models",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        meta: expect.objectContaining({
          count: expect.any(Number),
        }),
      }),
    );
  });

  it("creates a task and fetches it by id", async () => {
    const app = await createApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/tasks",
      payload: {
        packageId: "perfume-formulation",
        input: {
          goal: "我想做一款适合春季上新的木质调香水。",
          conversation: [
            {
              role: "user",
              content: "我想做一款适合春季上新的木质调香水。",
            },
          ],
        },
      },
    });

    expect(createResponse.statusCode).toBe(200);
    const createdTask = createResponse.json();
    expect(createdTask.status).toBe("queued");

    const settledTask = await waitForTask(app, createdTask.taskId, (status) => status === "awaiting_approval");
    expect(settledTask.pendingApproval?.nodeId).toBe("planner");
    expect(settledTask.pendingApproval?.payload?.question).toBeTruthy();

    const getResponse = await app.inject({
      method: "GET",
      url: `/tasks/${createdTask.taskId}`,
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toEqual(
      expect.objectContaining({
        taskId: createdTask.taskId,
        packageId: "perfume-formulation",
        status: expect.any(String),
      }),
    );
  });

  it("returns a 400 response when approval submission fails", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "POST",
      url: "/tasks/task_missing/approval",
      payload: {
        action: "approve",
        operator: "tester",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Bad Request",
      message: "Task not found: task_missing",
      statusCode: 400,
    });
  });
});
