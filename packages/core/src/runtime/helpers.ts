import type { EvidenceItem, PlanPatchItem, PlanStep, TaskResult } from "@agent-foundry/shared";
import type { AgentPackage, CreateAgentPackageConfig, PackageReviewResult } from "./types.js";

function insertAfterStep(plan: PlanStep[], step: PlanStep, afterStepId?: string | null, index?: number) {
  if (typeof index === "number") {
    const next = [...plan];
    next.splice(index, 0, step);
    return next;
  }

  if (!afterStepId) {
    return [...plan, step];
  }

  const next = [...plan];
  const targetIndex = next.findIndex((entry) => entry.id === afterStepId);
  if (targetIndex === -1) {
    next.push(step);
    return next;
  }

  next.splice(targetIndex + 1, 0, step);
  return next;
}

export function applyPlanPatch(plan: PlanStep[], patch: PlanPatchItem[] = []) {
  return patch.reduce((current, item) => {
    switch (item.op) {
      case "add":
        return item.step ? insertAfterStep(current, item.step, item.afterStepId, item.index) : current;
      case "update":
        return current.map((entry) => (entry.id === item.stepId ? { ...entry, ...(item.step ?? {}) } : entry));
      case "remove":
        return current.filter((entry) => entry.id !== item.stepId);
      case "move": {
        const moving = current.find((entry) => entry.id === item.stepId);
        if (!moving) {
          return current;
        }
        const without = current.filter((entry) => entry.id !== item.stepId);
        return insertAfterStep(without, moving, item.afterStepId, item.index);
      }
      default:
        return current;
    }
  }, plan);
}

export function createDefaultReviewer(): NonNullable<AgentPackage["review"]> {
  return async () =>
    ({
      reviewNotes: [],
      planningFeedback: null,
    }) satisfies PackageReviewResult;
}

export function createDefaultSummarizer() {
  return async (result: TaskResult) => {
    const output = typeof result.output === "object" && result.output !== null ? "结构化输出" : "结果";
    return `任务已完成，生成了${output}，并记录了 ${result.evidence.length} 条证据。`;
  };
}

export function buildNoopTools() {
  return [] as AgentPackage["tools"];
}

export function createAgentPackage(config: CreateAgentPackageConfig): AgentPackage {
  return {
    ...config,
    tools: config.tools ?? buildNoopTools(),
    review: config.review ?? createDefaultReviewer(),
    summarize: config.summarize ?? createDefaultSummarizer(),
  };
}
