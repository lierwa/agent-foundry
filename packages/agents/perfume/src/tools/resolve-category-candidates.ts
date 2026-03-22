import type { ToolDefinition } from "@agent-foundry/core";
import { resolveCategoryCandidates } from "../knowledge/query.js";

export const resolveCategoryCandidatesTool: ToolDefinition = {
  id: "resolve_category_candidates",
  description: "基于 definitions 分类定义匹配候选香材 ID。",
  async invoke(input) {
    return [...resolveCategoryCandidates(String(input ?? ""))];
  },
};
