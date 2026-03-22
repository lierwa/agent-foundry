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
  const total = Object.values(parsedOutput.output).flat().length;
  const notes: string[] = [];

  if (parsedOutput.output.Body.length === 0) {
    notes.push("Body 层不能为空。");
  }
  if (parsedOutput.output.Structure.length === 0) {
    notes.push("Structure 层不能为空。");
  }
  if (total < 5 || total > 8) {
    notes.push("香材总数必须在 5 到 8 之间。");
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
