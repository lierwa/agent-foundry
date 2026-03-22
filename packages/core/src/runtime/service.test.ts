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
};

function createTestPackage(options: TestPackageOptions = {}): AgentPackage {
  const plannerApproval = options.plannerApproval ?? false;
  const executorApproval = options.executorApproval ?? false;
  const confidence = options.confidence ?? 0.92;

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
    async createPlan(input: unknown) {
      const parsed = z.object({ goal: z.string() }).parse(input);
      return [
        {
          id: "step_1",
          title: "Plan task",
          objective: `Plan ${parsed.goal}`,
          status: "done" as const,
        },
      ];
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

describe("AgentRuntimeService", () => {
  it("enters the planning flow when creating a task", async () => {
    const { runtime } = createRuntime({ plannerApproval: false });

    const task = await runtime.createTask("test-package", { goal: "launch" });

    expect(task.currentNode).toBe("finalizer");
    expect(task.status).toBe("completed");
    expect(task.trace.some((entry) => entry.eventType === "planner.completed")).toBe(true);
  });

  it("pauses for planner approval when required", async () => {
    const { runtime, taskStore } = createRuntime({ plannerApproval: true });

    const task = await runtime.createTask("test-package", { goal: "approve plan" });
    const persisted = await taskStore.get(task.taskId);

    expect(task.status).toBe("awaiting_approval");
    expect(task.pendingApproval?.nodeId).toBe("planner");
    expect(persisted?.status).toBe("awaiting_approval");
  });

  it("resumes execution after approval submission", async () => {
    const { runtime, memoryStore } = createRuntime({
      plannerApproval: true,
      executorApproval: false,
      confidence: 0.91,
    });

    const created = await runtime.createTask("test-package", { goal: "resume execution" });
    const approved = await runtime.submitApproval(created.taskId, "approve", "tester");
    const memories = await memoryStore.listByTask(created.taskId);

    expect(approved.status).toBe("completed");
    expect(approved.result?.summary).toContain("Completed");
    expect(memories).toHaveLength(2);
  });

  it("pauses on low-confidence executor approval paths", async () => {
    const { runtime } = createRuntime({
      plannerApproval: true,
      executorApproval: true,
      confidence: 0.4,
    });

    const created = await runtime.createTask("test-package", { goal: "need review" });
    const approved = await runtime.submitApproval(created.taskId, "approve", "tester");

    expect(approved.status).toBe("awaiting_approval");
    expect(approved.pendingApproval?.nodeId).toBe("executor");
  });

  it("persists result and evidence state after successful completion", async () => {
    const { runtime, memoryStore } = createRuntime({
      plannerApproval: false,
      executorApproval: false,
      confidence: 0.95,
    });

    const task = await runtime.createTask("test-package", { goal: "persist state" });
    const memories = await memoryStore.listByTask(task.taskId);

    expect(task.result).not.toBeNull();
    expect(task.memoryRefs).toHaveLength(2);
    expect(memories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "structured" }),
        expect.objectContaining({ channel: "semantic" }),
      ]),
    );
  });
});
