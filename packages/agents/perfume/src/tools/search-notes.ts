import type { ToolDefinition } from "@agent-foundry/core";
import { searchNotes } from "../knowledge/query.js";

export const searchNotesTool: ToolDefinition = {
  id: "search_notes",
  description: "按香材名称、描述、气味家族搜索香材数据库。",
  async invoke(input) {
    return searchNotes(String(input ?? ""));
  },
};
