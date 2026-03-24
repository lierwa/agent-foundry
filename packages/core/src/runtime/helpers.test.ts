import { describe, expect, it } from "vitest";
import { applyPlanPatch, createAgentPackage } from "./helpers.js";
import { z } from "zod";

describe("runtime helpers", () => {
  it("applies plan patches incrementally", () => {
    const plan = [
      { id: "a", title: "A", objective: "first", status: "ready" as const, kind: "task", source: "planner" },
      { id: "b", title: "B", objective: "second", status: "pending" as const, kind: "task", source: "planner" },
    ];

    const next = applyPlanPatch(plan, [
      {
        op: "update",
        stepId: "b",
        step: { id: "b", title: "B", objective: "patched", status: "ready", kind: "repair", source: "planner" },
      },
      {
        op: "add",
        stepId: "c",
        afterStepId: "b",
        step: { id: "c", title: "C", objective: "third", status: "pending", kind: "task", source: "planner" },
      },
    ]);

    expect(next).toHaveLength(3);
    expect(next[1]?.objective).toBe("patched");
    expect(next[2]?.id).toBe("c");
  });

  it("builds a minimal agent package with default reviewer and summarizer", async () => {
    const pkg = createAgentPackage({
      id: "minimal-agent",
      version: "0.1.0",
      title: "Minimal Agent",
      description: "test",
      inputSchema: z.object({ goal: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
      tools: [],
      knowledgeProviders: [],
      approvalPolicy: { planner: false, executor: false },
      reviewPolicy: { validateSchema: true, requireEvidence: false },
      async createPlan() {
        return {
          plan: [],
          planningDecision: {
            phase: "initial",
            replanMode: "full",
            reason: "init",
            affectedSteps: [],
          },
        };
      },
      async execute() {
        return {
          outputDraft: { ok: true },
          evidence: [],
          confidence: 1,
          constraints: [],
          reviewNotes: [],
        };
      },
    });

    const review = await pkg.review?.({ ok: true }, [], { goal: "x" }, [], {
      taskId: "task_1",
      packageId: "minimal-agent",
      input: null,
      plan: [],
      approvalHistory: [],
      pendingApproval: null,
      selectedModel: null,
      async invokeTool() {
        return null;
      },
      async generateObject() {
        return null;
      },
    });
    const summary = await pkg.summarize({ output: { ok: true }, summary: "", evidence: [] });

    expect(review?.reviewNotes).toEqual([]);
    expect(summary).toContain("任务已完成");
  });
});
