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
          title: "Perfume Formulation Agent",
        }),
      ]),
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
          goal: "Fresh spring launch",
          season: "spring",
          preferredAccords: ["woody", "citrus"],
          avoidNotes: [],
          budgetLevel: "medium",
          manufacturableOnly: true,
          requiresHumanReview: false,
        },
      },
    });

    expect(createResponse.statusCode).toBe(200);
    const createdTask = createResponse.json();
    expect(createdTask.status).toBe("awaiting_approval");
    expect(createdTask.pendingApproval?.nodeId).toBe("planner");

    const getResponse = await app.inject({
      method: "GET",
      url: `/tasks/${createdTask.taskId}`,
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toEqual(
      expect.objectContaining({
        taskId: createdTask.taskId,
        packageId: "perfume-formulation",
        status: "awaiting_approval",
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
      message: "Task not found: task_missing",
    });
  });
});
