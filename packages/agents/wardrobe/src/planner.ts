import type { PackagePlannerResult, PackageRunContext } from "@agent-foundry/core";
import { wardrobeTaskInputSchema } from "./schemas.js";

export async function runWardrobePlanner(input: unknown, _context: PackageRunContext): Promise<PackagePlannerResult> {
  const parsed = wardrobeTaskInputSchema.parse(input);
  return {
    input: parsed,
    plan: [
      {
        id: "capture_style",
        title: "理解穿搭目标",
        objective: "把自然语言需求整理成当前穿搭任务目标。",
        status: "done",
        kind: "planning",
        source: "planner",
      },
      {
        id: "propose_outfit",
        title: "生成搭配建议",
        objective: "输出最小可用的穿搭建议。",
        status: "ready",
        kind: "execution",
        source: "planner",
      },
    ],
    planningDecision: {
      phase: "initial",
      replanMode: "full",
      reason: "首次创建 wardrobe 任务，生成初始计划。",
      affectedSteps: ["capture_style", "propose_outfit"],
    },
    trace: [
      {
        nodeId: "planner",
        eventType: "planner.re_evaluated",
        output: {
          goal: parsed.goal,
        },
      },
    ],
  };
}
