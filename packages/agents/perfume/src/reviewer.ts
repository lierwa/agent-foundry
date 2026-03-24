import type { PackageReviewResult, PackageRunContext } from "@agent-foundry/core";
import { perfumeAgentOutputSchema, perfumeAgentStateSchema } from "./schemas.js";
import { buildReviewerPrompt } from "./prompt-builders.js";

export async function runReviewer(
  outputDraft: unknown,
  input: unknown,
  _plan: PackageRunContext["plan"],
  _context: PackageRunContext,
): Promise<PackageReviewResult> {
  const parsedInput = perfumeAgentStateSchema.parse(input);
  const parsedOutput = perfumeAgentOutputSchema.parse(outputDraft);
  const prompt = buildReviewerPrompt(parsedInput.intention, parsedInput.clarification, parsedOutput);
  const total = Object.values(parsedOutput).flat().length;
  const notes: string[] = [];
  const lowerGoal = parsedInput.goal.toLowerCase();

  if (parsedOutput.Body.length === 0) {
    notes.push("Body 层不能为空。");
  }
  if (parsedOutput.Structure.length === 0) {
    notes.push("Structure 层不能为空。");
  }
  if (total < 5 || total > 8) {
    notes.push("香材总数必须在 5 到 8 之间。");
  }
  if (parsedOutput.Buffer.length > 0 && parsedOutput.Impact.length === 0) {
    notes.push("没有 Impact 的情况下不应保留 Buffer。");
  }
  if (parsedOutput.Bridge.length > 0 && (parsedOutput.Body.length === 0 || parsedOutput.Structure.length === 0)) {
    notes.push("Bridge 只能在 Body 与 Structure 之间存在真实断层时使用。");
  }

  const woodyCount = Object.values(parsedOutput)
    .flat()
    .filter((materialId) => materialId.includes("木") || materialId.toLowerCase().includes("wood"))
    .length;
  if (lowerGoal.includes("春") && woodyCount === total && total > 0) {
    notes.push("当前结构过度单一为木质堆叠，不符合春季上新所需的轻透层次。");
  }
  if ((lowerGoal.includes("不要太刺激") || lowerGoal.includes("不刺激")) && parsedOutput.Impact.length > 1) {
    notes.push("用户要求前段不要太刺激，Impact 层当前过强。");
  }
  if (parsedInput.intention?.dominant_layer === "Body" && parsedOutput.Body.length === 0) {
    notes.push("dominant_layer 为 Body 时，Body 必须承担主体表达。");
  }
  if (parsedInput.intention?.impact_policy === "forbidden" && parsedOutput.Impact.length > 0) {
    notes.push("impact_policy 为 forbidden 时，Impact 必须为空。");
  }

  return {
    reviewNotes: notes,
    planningFeedback:
      notes.length === 0
        ? null
        : {
            source: "reviewer",
            reason: "reviewer 校验失败，需要重新评估计划。",
            suggestedReplanMode: "partial",
            details: notes,
          },
    trace: [
      {
        nodeId: "reviewer",
        eventType: "review.prompt_built",
        output: { prompt },
      },
    ],
  };
}
