import type { ToolDefinition } from "@agent-foundry/core";
import type { PerfumeAgentOutput } from "../schemas.js";

export function validateStructure(output: PerfumeAgentOutput) {
  const layers = output.output;
  const total = Object.values(layers).flat().length;
  const issues: string[] = [];

  if (layers.Body.length === 0) {
    issues.push("Body 层不能为空。");
  }
  if (layers.Structure.length === 0) {
    issues.push("Structure 层不能为空。");
  }
  if (total < 5 || total > 8) {
    issues.push("香材总数必须在 5 到 8 之间。");
  }
  if (layers.Impact.length > 0 && layers.Buffer.length === 0 && layers.Body.length === 0) {
    issues.push("Impact 不能单独存在。");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export const validateStructureTool: ToolDefinition = {
  id: "validate_structure",
  description: "校验六层结构是否满足基础硬约束。",
  async invoke(input) {
    return validateStructure(input as PerfumeAgentOutput);
  },
};
