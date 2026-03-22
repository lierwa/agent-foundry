import type { PackageExecutionResult, PackageRunContext } from "@agent-foundry/core";
import {
  perfumeAgentOutputSchema,
  perfumeAgentStateSchema,
  type PerfumeAgentCandidateSet,
  type PerfumeAgentOutput,
  type PerfumeAgentState,
} from "./schemas.js";
import { buildExecutorPrompt } from "./prompt-builders.js";

function approvalDrivenPoolUpdate(state: PerfumeAgentState, context: PackageRunContext) {
  const latest = [...context.approvalHistory].reverse().find((item) => item.nodeId === "planner");
  if (!latest || !state.intention) {
    return state;
  }

  const payload = (latest.payload ?? {}) as { selections?: string[]; note?: string };
  if ((payload.selections?.length ?? 0) === 0 && !payload.note) {
    return state;
  }

  return {
    ...state,
    intention: {
      ...state.intention,
      expressive_pool: [...new Set([...(state.intention.expressive_pool ?? []), ...(payload.selections ?? [])])],
    },
  };
}

export async function runExecutor(input: unknown, plan: PackageRunContext["plan"], context: PackageRunContext): Promise<PackageExecutionResult> {
  let state = perfumeAgentStateSchema.parse(input);
  state = approvalDrivenPoolUpdate(state, context);

  const candidatePool = (await context.invokeTool("build_candidate_pool", state.goal)) as PerfumeAgentCandidateSet;
  const prompt = buildExecutorPrompt(state, state.intention, candidatePool, state.structureDraft);
  const output = (await context.invokeTool("compose_structure_layers", {
    intention: state.intention,
    candidatePool,
  })) as PerfumeAgentOutput;
  const parsedOutput = perfumeAgentOutputSchema.parse(output);
  const validation = await context.invokeTool("validate_structure", parsedOutput);
  const issues = (validation as { valid: boolean; issues: string[] }).issues;

  const nextState: PerfumeAgentState = {
    ...state,
    candidatePool,
    structureDraft: parsedOutput,
    clarification: null,
    pendingPlanningFeedback:
      issues.length === 0
        ? null
        : {
            source: "executor",
            reason: "当前结构仍有缺口，需要继续动态调整。",
            suggestedReplanMode: "partial",
            details: issues,
          },
  };

  const outputIds = Object.values(parsedOutput.output).flat();
  const evidence = outputIds.map((id) => ({
    id,
    title: id,
    content: `由本地香材库与规则生成的结构成员：${id}`,
    source: "perfume-knowledge",
    confidence: issues.length === 0 ? 0.88 : 0.67,
    constraints: issues,
  }));

  const updatedPlanPatch = [
    {
      op: "update" as const,
      stepId: "capture_intention",
      step: {
        id: "capture_intention",
        title: "归纳香气意向",
        objective: "根据当前对话生成 intention 草案，并识别信息缺口。",
        status: "done" as const,
        kind: "planning",
        source: "planner",
      },
    },
    {
      op: "update" as const,
      stepId: "build_candidate_pool",
      step: {
        id: "build_candidate_pool",
        title: "构建候选池",
        objective: "从本地香材库和分类定义推导 top / middle / base 候选池。",
        status: "done" as const,
        kind: "analysis",
        source: "executor",
      },
    },
    {
      op: "update" as const,
      stepId: "compose_structure",
      step: {
        id: "compose_structure",
        title: "组六层结构",
        objective: "根据 intention 与候选池生成六层结构 JSON。",
        status: issues.length === 0 ? ("done" as const) : ("ready" as const),
        kind: "execution",
        source: "executor",
      },
    },
  ];

  const repairPatch = issues.length === 0
    ? []
    : [
        {
          op: "add" as const,
          stepId: "repair_structure",
          afterStepId: "compose_structure",
          step: {
            id: "repair_structure",
            title: "修正结构缺口",
            objective: issues.join(" "),
            status: "ready" as const,
            kind: "repair",
            source: "executor",
          },
        },
      ];

  const updatedPlan = plan.map((step) => {
    if (step.id === "capture_intention") {
      return { ...step, status: "done" as const };
    }
    if (step.id === "build_candidate_pool") {
      return { ...step, status: "done" as const };
    }
    if (step.id === "compose_structure") {
      return { ...step, status: issues.length === 0 ? ("done" as const) : ("ready" as const) };
    }
    return step;
  });

  return {
    input: nextState,
    planPatch: [...updatedPlanPatch, ...repairPatch],
    outputDraft: parsedOutput,
    evidence,
    confidence: issues.length === 0 ? 0.88 : 0.61,
    constraints: issues,
    reviewNotes: [],
    planningFeedback:
      issues.length === 0
        ? null
        : {
            source: "executor",
            reason: "结构校验存在缺口，需要 planner 重新评估。",
            suggestedReplanMode: "partial",
            details: issues,
          },
    pendingApproval: issues.length === 0
      ? null
      : {
          nodeId: "planner",
          reason: "当前结构仍有缺口，需要你补充偏好后继续调整。",
          payload: {
            key: "structure_repair",
            decisionKey: "structure_repair",
            question: "当前结构仍有缺口，需要你补充偏好后继续调整。",
            multiple: true,
            options: issues.map((issue) => ({ label: issue, value: issue })),
            allowsFreeText: true,
          },
        },
    trace: [
      {
        nodeId: "executor",
        eventType: "candidate_pool.updated",
        output: {
          prompt,
          candidatePool,
        },
      },
      {
        nodeId: "executor",
        eventType: "structure.composed",
        output: parsedOutput,
      },
      {
        nodeId: "executor",
        eventType: "plan.updated",
        output: [...updatedPlanPatch, ...repairPatch],
      },
    ],
  };
}
