import type { PackagePlannerResult, PackageRunContext } from "@agent-foundry/core";
import type { PerfumeAgentState } from "./schemas.js";
import { buildPlannerPrompt } from "./prompt-builders.js";
import { perfumeAgentStateSchema } from "./schemas.js";
import type { PlanPatchItem, PlanningDecision, PlanStep } from "@agent-foundry/shared";
import { generatePlannerArtifacts } from "./model.js";

type ApprovalPayload = {
  selections?: string[];
  note?: string;
};

function applyApprovalAnswers(state: PerfumeAgentState, context: PackageRunContext) {
  const latest = [...context.approvalHistory].reverse().find((item) => item.nodeId === "planner");
  if (!latest) {
    return state;
  }

  const payload = (latest.payload ?? {}) as ApprovalPayload;
  const note = payload.note?.trim();
  const selections = payload.selections ?? [];
  const next = { ...state };
  if (note) {
    next.conversation = [...next.conversation, { role: "user" as const, content: note }];
  }
  if (selections.length > 0) {
    next.conversation = [...next.conversation, { role: "user" as const, content: selections.join("，") }];
  }
  if (next.clarification?.key === "core_theme" && selections[0]) {
    next.intention = {
      ...(next.intention ?? {
        core_theme: null,
        expressive_pool: [],
        dominant_layer: "Body",
        impact_policy: "limited",
        avoid_notes: [],
        confidence_level: "low",
      }),
      core_theme: selections[0],
    };
  }
  if (next.clarification?.key === "expressive_pool" && selections.length > 0) {
    next.intention = {
      ...(next.intention ?? {
        core_theme: null,
        expressive_pool: [],
        dominant_layer: "Body",
        impact_policy: "limited",
        avoid_notes: [],
        confidence_level: "low",
      }),
      expressive_pool: selections,
      confidence_level: note ? "high" : "medium",
    };
  }
  return next;
}

function createBasePlan(): PlanStep[] {
  return [
    {
      id: "capture_intention",
      title: "归纳香气意向",
      objective: "根据当前对话生成 intention 草案，并识别信息缺口。",
      status: "done" as const,
      kind: "planning",
      source: "planner",
    },
    {
      id: "build_candidate_pool",
      title: "构建候选池",
      objective: "从本地香材库和分类定义推导 top / middle / base 候选池。",
      status: "ready" as const,
      kind: "analysis",
      source: "planner",
    },
    {
      id: "compose_structure",
      title: "组六层结构",
      objective: "根据 intention 与候选池生成六层结构 JSON。",
      status: "pending" as const,
      kind: "execution",
      source: "planner",
    },
  ];
}

function decideReplanMode(
  previous: PerfumeAgentState,
  next: PerfumeAgentState,
  latestApproval: ApprovalPayload | null,
): { planningDecision: PlanningDecision; plan?: ReturnType<typeof createBasePlan>; planPatch?: PlanPatchItem[] } {
  if (!previous.lastPlanningDecision) {
    return {
      planningDecision: {
        phase: "initial",
        replanMode: "full",
        reason: "首次创建任务，需要生成初始计划。",
        affectedSteps: ["capture_intention", "build_candidate_pool", "compose_structure"],
      },
      plan: next.clarification
        ? createBasePlan().map((step, index) =>
            index === 0 ? step : { ...step, status: "blocked" as const },
          )
        : createBasePlan(),
    };
  }

  if (previous.intention?.core_theme && next.intention?.core_theme && previous.intention.core_theme !== next.intention.core_theme) {
    return {
      planningDecision: {
        phase: "approval",
        replanMode: "full",
        reason: "核心主题发生变化，需要重建整个计划。",
        affectedSteps: ["capture_intention", "build_candidate_pool", "compose_structure"],
      },
      plan: next.clarification
        ? createBasePlan().map((step, index) =>
            index === 0 ? step : { ...step, status: "blocked" as const },
          )
        : createBasePlan(),
    };
  }

  if ((latestApproval?.selections?.length ?? 0) > 0 || latestApproval?.note) {
    return {
      planningDecision: {
        phase: "approval",
        replanMode: "partial",
        reason: "人工澄清补充了局部意向，需要插入或更新修正步骤。",
        affectedSteps: ["build_candidate_pool", "compose_structure"],
      },
      planPatch: [
        {
          op: "update",
          stepId: "build_candidate_pool",
          step: {
            id: "build_candidate_pool",
            title: "构建候选池",
            objective: "根据最新澄清重新推导候选池。",
            status: "ready",
            kind: "analysis",
            source: "planner",
          },
        },
        {
          op: "update",
          stepId: "compose_structure",
          step: {
            id: "compose_structure",
            title: "组六层结构",
            objective: "基于更新后的候选池重组六层结构。",
            status: "pending",
            kind: "execution",
            source: "planner",
          },
        },
      ],
    };
  }

  if (previous.pendingPlanningFeedback) {
    const feedbackReason = previous.pendingPlanningFeedback.reason;
    const repairStepId =
      previous.pendingPlanningFeedback.source === "executor" ? "repair_structure" : "repair_after_review";
    return {
      planningDecision: {
        phase: previous.pendingPlanningFeedback.source === "reviewer" ? "review_feedback" : "execution_feedback",
        replanMode: previous.pendingPlanningFeedback.suggestedReplanMode,
        reason: feedbackReason,
        affectedSteps: ["compose_structure", repairStepId],
      },
      planPatch: [
        {
          op: "add",
          stepId: repairStepId,
          afterStepId: "compose_structure",
          step: {
            id: repairStepId,
            title: previous.pendingPlanningFeedback.source === "reviewer" ? "根据审校意见修正结构" : "修正结构缺口",
            objective: feedbackReason,
            status: "ready",
            kind: "repair",
            source: previous.pendingPlanningFeedback.source,
          },
        },
        {
          op: "update",
          stepId: "compose_structure",
          step: {
            id: "compose_structure",
            title: "组六层结构",
            objective: "根据最新反馈重新组六层结构。",
            status: "ready",
            kind: "execution",
            source: "planner",
          },
        },
      ],
    };
  }

  return {
    planningDecision: {
      phase: "approval",
      replanMode: "none",
      reason: "当前补充信息未改变任务前提，维持现有计划。",
      affectedSteps: [],
    },
  };
}

export async function runPlanner(input: unknown, context: PackageRunContext): Promise<PackagePlannerResult> {
  const baseState = perfumeAgentStateSchema.parse(input);
  const state = applyApprovalAnswers(baseState, context);
  const prompt = buildPlannerPrompt(state, state.intention);
  const latestApproval =
    (([...context.approvalHistory].reverse().find((item) => item.nodeId === "planner")?.payload ?? null) as ApprovalPayload | null);
  const modelArtifacts = await generatePlannerArtifacts(context, prompt);
  const intention: NonNullable<PerfumeAgentState["intention"]> = {
    ...modelArtifacts.intention,
    core_theme: modelArtifacts.intention.core_theme,
    expressive_pool: modelArtifacts.intention.expressive_pool ?? [],
    dominant_layer: modelArtifacts.intention.dominant_layer,
    impact_policy: modelArtifacts.intention.impact_policy,
    avoid_notes: modelArtifacts.intention.avoid_notes ?? [],
    confidence_level: modelArtifacts.intention.confidence_level,
  };
  const clarification = modelArtifacts.clarification;

  const nextState: PerfumeAgentState = {
    ...state,
    intention: intention ?? state.intention,
    clarification: (clarification as PerfumeAgentState["clarification"]) ?? null,
    pendingPlanningFeedback: clarification ? state.pendingPlanningFeedback : null,
    planningContext: {
      cycle: (state.planningContext?.cycle ?? 0) + 1,
      lastEvent: context.approvalHistory.length > 0 ? "approval" : "task_created",
    },
  };
  const { planningDecision, plan, planPatch } = decideReplanMode(baseState, nextState, latestApproval);
  nextState.lastPlanningDecision = planningDecision;

  return {
    input: nextState,
    plan,
    planPatch,
    planningDecision,
    pendingApproval: clarification
      ? {
          nodeId: "planner",
          reason: clarification.question,
          payload: clarification,
        }
      : null,
    trace: [
      {
        nodeId: "planner",
        eventType: "intention.updated",
        output: {
          prompt,
          intention,
          clarification,
          model: context.selectedModel?.id ?? null,
        },
      },
      {
        nodeId: "planner",
        eventType: "planner.re_evaluated",
        output: planningDecision,
      },
      {
        nodeId: "planner",
        eventType: "plan.updated",
        output: {
          steps: planPatch ?? plan ?? [],
          model: context.selectedModel?.id ?? null,
        },
      },
    ],
  };
}
