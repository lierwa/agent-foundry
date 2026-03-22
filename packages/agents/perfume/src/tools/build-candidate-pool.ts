import type { ToolDefinition } from "@agent-foundry/core";
import { buildCandidatePool } from "../knowledge/query.js";

export const buildCandidatePoolTool: ToolDefinition = {
  id: "build_candidate_pool",
  description: "从本地香材库构造 top / middle / base 候选池。",
  async invoke(input) {
    return buildCandidatePool(String(input ?? ""));
  },
};
