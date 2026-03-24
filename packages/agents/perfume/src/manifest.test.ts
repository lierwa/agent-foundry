import { describe, expect, it } from "vitest";
import { perfumeAgentPackage } from "./manifest.js";

function createContext(overrides: Partial<Parameters<typeof perfumeAgentPackage.createPlan>[1]> = {}) {
  return {
    taskId: "task_test",
    packageId: "perfume-formulation",
    input: null,
    plan: [],
    approvalHistory: [],
    pendingApproval: null,
    selectedModel: {
      id: "test-model",
      label: "Test Model",
      provider: "mock",
      model: "mock-model",
    },
    async invokeTool(toolId: string, input: unknown) {
      const tool = perfumeAgentPackage.tools.find((entry) => entry.id === toolId);
      if (!tool) {
        throw new Error(`Missing tool: ${toolId}`);
      }
      return tool.invoke(input, {
        taskId: "task_test",
        packageId: "perfume-formulation",
        currentNode: "planner",
      });
    },
    async generateObject() {
      throw new Error("generateObject mock is required for this test.");
    },
    ...overrides,
  };
}

describe("perfumeAgentPackage", () => {
  it("creates a clarification question for an underspecified brief", async () => {
    const result = await perfumeAgentPackage.createPlan(
      {
        goal: "帮我做一支香水。",
        conversation: [{ role: "user", content: "帮我做一支香水。" }],
      },
      createContext({
        async generateObject() {
          return {
            intention: {
              core_theme: null,
              expressive_pool: [],
              dominant_layer: "Body",
              impact_policy: "limited",
              avoid_notes: [],
              confidence_level: "low",
            },
            clarification: {
              key: "core_theme",
              decisionKey: "core_theme",
              question: "你更想把这支香水做成哪种主方向？",
              multiple: false,
              options: [
                { label: "木质", value: "木质" },
                { label: "花香", value: "花香" },
              ],
              allowsFreeText: true,
            },
          };
        },
      }),
    );

    expect(result.pendingApproval?.nodeId).toBe("planner");
    expect(result.pendingApproval?.payload).toEqual(
      expect.objectContaining({
        key: expect.any(String),
        question: expect.any(String),
      }),
    );
    expect(result.trace?.some((entry) => entry.eventType === "plan.updated")).toBe(true);
  });

  it("builds a six-layer output after clarification answers are provided", async () => {
    const planning = await perfumeAgentPackage.createPlan(
      {
        goal: "我想做一款春季木质调香水。",
        conversation: [{ role: "user", content: "我想做一款春季木质调香水。" }],
        intention: null,
        candidatePool: null,
        clarification: {
          key: "expressive_pool",
          decisionKey: "expressive_pool",
          question: "你希望主体表达更靠近哪些香材或气味方向？",
          multiple: true,
          options: [],
          allowsFreeText: true,
        },
        planningContext: { cycle: 1, lastEvent: "approval" },
        lastPlanningDecision: {
          phase: "initial",
          replanMode: "full",
          reason: "首次创建",
          affectedSteps: ["capture_intention"],
        },
        pendingPlanningFeedback: null,
        structureDraft: null,
      },
      createContext({
        plan: [
          {
            id: "capture_intention",
            title: "归纳香气意向",
            objective: "根据当前对话生成 intention 草案，并识别信息缺口。",
            status: "done",
            kind: "planning",
            source: "planner",
          },
          {
            id: "build_candidate_pool",
            title: "构建候选池",
            objective: "从本地香材库和分类定义推导 top / middle / base 候选池。",
            status: "ready",
            kind: "analysis",
            source: "planner",
          },
          {
            id: "compose_structure",
            title: "组六层结构",
            objective: "根据 intention 与候选池生成六层结构 JSON。",
            status: "pending",
            kind: "execution",
            source: "planner",
          },
        ],
        approvalHistory: [
          {
            taskId: "task_test",
            nodeId: "planner",
            action: "approve",
            operator: "tester",
            payload: {
              selections: ["木质", "冷感木质"],
              note: "主体希望偏冷一些。",
            },
            timestamp: new Date().toISOString(),
          },
        ],
        async generateObject({ prompt }) {
          if (String(prompt).includes("上一次结构草案")) {
            return {
              Impact: [],
              Buffer: [],
              Body: ["3008_雪松_middle", "3009_云衫_middle"],
              Bridge: ["3010_松木_middle"],
              Structure: ["3005_金丝楠木_base", "3008_雪松_base"],
              Fix: [],
            };
          }

          return {
            intention: {
              core_theme: "木质",
              expressive_pool: ["木质", "冷感木质", "茶香"],
              dominant_layer: "Body",
              impact_policy: "forbidden",
              avoid_notes: ["太刺激"],
              confidence_level: "high",
            },
            clarification: null,
          };
        },
      }),
    );

    expect(planning.pendingApproval).toBeNull();
    expect(planning.planningDecision.replanMode).toBe("partial");

    const execution = await perfumeAgentPackage.execute(
      planning.input,
      planning.plan ?? [],
      createContext({
        input: planning.input,
        plan: planning.plan ?? [],
        approvalHistory: [
          {
            taskId: "task_test",
            nodeId: "planner",
            action: "approve",
            operator: "tester",
            payload: {
              selections: ["木质", "冷感木质"],
              note: "主体希望偏冷一些。",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    );

    expect(execution.outputDraft).toEqual(
      expect.objectContaining({
        Body: expect.any(Array),
        Structure: expect.any(Array),
      }),
    );
    expect(execution.trace?.some((entry) => entry.eventType === "candidate_pool.updated")).toBe(true);
    expect(execution.planPatch?.some((entry) => entry.stepId === "build_candidate_pool")).toBe(true);
    expect(execution.planningFeedback ?? null).toBeNull();
  });

  it("triggers full replan when the core theme changes materially", async () => {
    const planning = await perfumeAgentPackage.createPlan(
      {
        goal: "我想做一款花香香水。",
        conversation: [{ role: "user", content: "我想做一款花香香水。" }],
        intention: {
          core_theme: "木质",
          expressive_pool: ["木质"],
          dominant_layer: "Body",
          impact_policy: "limited",
          avoid_notes: [],
          confidence_level: "medium",
        },
        candidatePool: null,
        clarification: {
          key: "core_theme",
          decisionKey: "core_theme",
          question: "你更想把这支香水做成哪种主方向？",
          multiple: false,
          options: [],
          allowsFreeText: true,
        },
        planningContext: { cycle: 1, lastEvent: "approval" },
        lastPlanningDecision: {
          phase: "initial",
          replanMode: "full",
          reason: "首次创建",
          affectedSteps: [],
        },
        pendingPlanningFeedback: null,
        structureDraft: null,
      },
      createContext({
        approvalHistory: [
          {
            taskId: "task_test",
            nodeId: "planner",
            action: "approve",
            operator: "tester",
            payload: {
              selections: ["花香"],
            },
            timestamp: new Date().toISOString(),
          },
        ],
        async generateObject() {
          return {
            intention: {
              core_theme: "花香",
              expressive_pool: ["白花", "茶香"],
              dominant_layer: "Body",
              impact_policy: "limited",
              avoid_notes: [],
              confidence_level: "high",
            },
            clarification: null,
          };
        },
      }),
    );

    expect(planning.planningDecision.replanMode).toBe("full");
  });
});
