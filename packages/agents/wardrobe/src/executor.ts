import type { PackageExecutionResult, PackageRunContext } from "@agent-foundry/core";
import { wardrobeTaskOutputSchema } from "./schemas.js";

export async function runWardrobeExecutor(
  _input: unknown,
  _plan: PackageRunContext["plan"],
  context: PackageRunContext,
): Promise<PackageExecutionResult> {
  const outputDraft = wardrobeTaskOutputSchema.parse({
    summary: `Wardrobe agent completed ${context.taskId}`,
    items: ["基础白衬衫", "深色长裤", "低调外套"],
  });

  return {
    outputDraft,
    evidence: [
      {
        id: "wardrobe-template",
        title: "Wardrobe Template Evidence",
        content: "默认模板输出",
        source: "wardrobe-template",
        confidence: 0.8,
        constraints: [],
      },
    ],
    confidence: 0.8,
    constraints: [],
    reviewNotes: [],
    planningFeedback: null,
  };
}
