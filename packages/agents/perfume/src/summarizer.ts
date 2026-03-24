import type { TaskResult } from "@agent-foundry/shared";
import { perfumeAgentOutputSchema } from "./schemas.js";

export async function summarizePerfumeResult(result: TaskResult) {
  const output = perfumeAgentOutputSchema.parse(result.output);
  const total = Object.values(output).flat().length;
  return `已生成六层香水结构，包含 ${total} 个香材，并完成 intention 与候选池驱动的动态规划。`;
}
