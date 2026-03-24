import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { AgentPackage, PackageRunContext } from "./types.js";
import { AgentRuntimeService } from "./service.js";
import { PackageRegistry } from "./registry.js";
import { InMemoryMemoryStore, InMemoryTaskStore } from "../adapters/in-memory.js";

type TestPackageOptions = {
  plannerApproval?: boolean;
  executorApproval?: boolean;
  confidence?: number;
  replanMode?: "none" | "partial" | "full";
};

function createTestPackage(options: TestPackageOptions = {}): AgentPackage {
  const plannerApproval = options.plannerApproval ?? false;
  const executorApproval = options.executorApproval ?? false;
  const confidence = options.confidence ?? 0.92;
  const replanMode = options.replanMode ?? "full";

  return {
    id: "test-package",
    version: "0.1.0",
    title: "Test Package",
    description: "Deterministic runtime lifecycle test package.",
    inputSchema: z.object({
      goal: z.string(),
    }),
    outputSchema: z.object({
      message: z.string(),
    }),
    tools: [],
    knowledgeProviders: [],
    graphConfig: {
      plannerRequiresApproval: plannerApproval,
      executorRequiresApprovalWhenConfidenceBelow: 0.8,
    },
    approvalPolicy: {
      planner: plannerApproval,
      executor: executorApproval,
    },
    reviewPolicy: {
      validateSchema: true,
      requireEvidence: true,
    },
    async createPlan(input: unknown, context: PackageRunContext) {
      const parsed = z.object({ goal: z.string() }).parse(input);
      const plannerAlreadyApproved = context.approvalHistory.some((event) => event.nodeId === "planner");
      return plannerApproval && !plannerAlreadyApproved
        ? {
            input: parsed,
            plan: [
              {
                id: "step_1",
                title: "Plan task",
                objective: `Plan ${parsed.goal}`,
                status: "ready" as const,
                kind: "planning",
                source: "planner",
              },
            ],
            pendingApproval: {
              nodeId: "planner",
              reason: "Need approval before execution.",
              payload: {
                key: "planner_check",
                decisionKey: "planner_check",
                question: "Proceed with execution?",
                multiple: false,
                options: [{ label: "继续", value: "continue" }],
                allowsFreeText: true,
              },
            },
            planningDecision: {
              phase: "initial" as const,
              replanMode: "full" as const,
              reason: "Create initial plan",
              affectedSteps: ["step_1"],
            },
          }
        : {
            plan: [
              {
                id: "step_1",
                title: "Plan task",
                objective: `Plan ${parsed.goal}`,
                status: "done" as const,
                kind: "planning",
                source: "planner",
              },
            ],
            planningDecision: {
              phase: plannerAlreadyApproved ? "approval" : "initial",
              replanMode,
              reason: replanMode === "none" ? "No plan changes needed" : "Plan updated",
              affectedSteps: replanMode === "none" ? [] : ["step_1"],
            },
            ...(replanMode === "partial"
              ? {
                  planPatch: [
                    {
                      op: "update" as const,
                      stepId: "step_1",
                      step: {
                        id: "step_1",
                        title: "Plan task",
                        objective: `Plan ${parsed.goal} (patched)`,
                        status: "done" as const,
                        kind: "planning",
                        source: "planner",
                      },
                    },
                  ],
                }
              : {}),
          };
    },
    async execute(_input: unknown, _plan, context: PackageRunContext) {
      return {
        outputDraft: {
          message: `Completed ${context.taskId}`,
        },
        evidence: [
          {
            id: "evidence_1",
            title: "Evidence",
            content: "Execution evidence",
            source: "unit-test",
            confidence,
            constraints: [],
          },
        ],
        confidence,
        constraints: [],
        reviewNotes: [],
      };
    },
    async summarize(result) {
      const parsed = z.object({ message: z.string() }).parse(result.output);
      return parsed.message;
    },
  };
}

function createRuntime(options: TestPackageOptions = {}) {
  const registry = new PackageRegistry();
  const taskStore = new InMemoryTaskStore();
  const memoryStore = new InMemoryMemoryStore();
  registry.register(createTestPackage(options));
  return {
    runtime: new AgentRuntimeService(registry, taskStore, memoryStore),
    taskStore,
    memoryStore,
  };
}

async function waitForTask(
  taskStore: InMemoryTaskStore,
  taskId: string,
  predicate: (status: string) => boolean,
): Promise<Awaited<ReturnType<InMemoryTaskStore["get"]>>> {
  const deadline = Date.now() + 3000;

  while (Date.now() < deadline) {
    const task = await taskStore.get(taskId);
    if (task && predicate(task.status)) {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  return taskStore.get(taskId);
}

describe("AgentRuntimeService", () => {
  it("enters the planning flow when creating a task", async () => {
    const { runtime, taskStore } = createRuntime({ plannerApproval: false });

    const task = await runtime.createTask("test-package", { goal: "launch" });
    const completed = await waitForTask(taskStore, task.taskId, (status) => status === "completed");

    expect(task.currentNode).toBe("planner");
    expect(task.status).toBe("queued");
    expect(completed?.currentNode).toBe("finalizer");
    expect(completed?.status).toBe("completed");
    expect(completed?.trace.some((entry) => entry.eventType === "planner.completed")).toBe(true);
  });

  it("pauses for planner approval when required", async () => {
    const { runtime, taskStore } = createRuntime({ plannerApproval: true });

    const task = await runtime.createTask("test-package", { goal: "approve plan" });
    const persisted = await waitForTask(taskStore, task.taskId, (status) => status === "awaiting_approval");

    expect(task.status).toBe("queued");
    expect(persisted?.pendingApproval?.nodeId).toBe("planner");
    expect(persisted?.status).toBe("awaiting_approval");
  });

  it("resumes execution after approval submission", async () => {
    const { runtime, memoryStore, taskStore } = createRuntime({
      plannerApproval: true,
      executorApproval: false,
      confidence: 0.91,
      replanMode: "none",
    });

    const created = await runtime.createTask("test-package", { goal: "resume execution" });
    await waitForTask(taskStore, created.taskId, (status) => status === "awaiting_approval");
    const approved = await runtime.submitApproval(created.taskId, "approve", "tester");
    const completed = await waitForTask(taskStore, created.taskId, (status) => status === "completed");
    const memories = await memoryStore.listByTask(created.taskId);

    expect(approved.status).toBe("running");
    expect(completed?.result?.summary).toContain("Completed");
    expect(memories).toHaveLength(2);
  });

  it("pauses on low-confidence executor approval paths", async () => {
    const { runtime, taskStore } = createRuntime({
      plannerApproval: true,
      executorApproval: true,
      confidence: 0.4,
      replanMode: "none",
    });

    const created = await runtime.createTask("test-package", { goal: "need review" });
    await waitForTask(taskStore, created.taskId, (status) => status === "awaiting_approval");
    const approved = await runtime.submitApproval(created.taskId, "approve", "tester");
    const paused = await waitForTask(taskStore, created.taskId, (status) => status === "awaiting_approval");

    expect(approved.status).toBe("running");
    expect(paused?.pendingApproval?.nodeId).toBe("executor");
  });

  it("persists result and evidence state after successful completion", async () => {
    const { runtime, memoryStore, taskStore } = createRuntime({
      plannerApproval: false,
      executorApproval: false,
      confidence: 0.95,
    });

    const task = await runtime.createTask("test-package", { goal: "persist state" });
    const completed = await waitForTask(taskStore, task.taskId, (status) => status === "completed");
    const memories = await memoryStore.listByTask(task.taskId);

    expect(completed?.result).not.toBeNull();
    expect(completed?.memoryRefs).toHaveLength(2);
    expect(memories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "structured" }),
        expect.objectContaining({ channel: "semantic" }),
      ]),
    );
  });

  it("persists session-scoped memory in the runtime store", async () => {
    const { runtime, taskStore } = createRuntime({
      plannerApproval: false,
      executorApproval: false,
      confidence: 0.95,
    });

    const task = await runtime.createTask("test-package", { goal: "remember this session" }, undefined, "session_1");
    await waitForTask(taskStore, task.taskId, (status) => status === "completed");
    const sessionMemory = await runtime.getSessionMemory("session_1");

    expect(sessionMemory.sessionId).toBe("session_1");
    expect(sessionMemory.history[0]?.taskId).toBe(task.taskId);
    expect(sessionMemory.artifacts.finalOutput).toEqual({
      message: expect.stringContaining(task.taskId),
    });
  });

  it("applies partial replans through plan patches after planner re-evaluation", async () => {
    const { runtime, taskStore } = createRuntime({
      plannerApproval: true,
      replanMode: "partial",
    });

    const created = await runtime.createTask("test-package", { goal: "patch my plan" });
    await waitForTask(taskStore, created.taskId, (status) => status === "awaiting_approval");
    const approved = await runtime.submitApproval(created.taskId, "approve", "tester");
    const completed = await waitForTask(taskStore, created.taskId, (status) => status === "completed");

    expect(approved.status).toBe("running");
    expect(completed?.plan[0]?.objective).toContain("(patched)");
    expect(completed?.trace.some((entry) => entry.eventType === "planner.re_evaluated")).toBe(true);
    expect(completed?.trace.some((entry) => entry.eventType === "plan.step_updated")).toBe(true);
  });
});
