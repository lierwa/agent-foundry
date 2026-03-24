import type { ToolDefinition } from "@agent-foundry/core";
import { perfumeAgentInputSchema, type PerfumeAgentInput, type PerfumeAgentIntention } from "../schemas.js";

function extractAvoidNotes(goal: string) {
  const matched = goal.match(/(?:不要|避免|不想要)([^。；，,\n]+)/g) ?? [];
  return matched.map((entry) => entry.replace(/^(?:不要|避免|不想要)/, "").trim()).filter(Boolean);
}

function inferCoreTheme(goal: string) {
  const text = goal.toLowerCase();
  if (text.includes("木") || text.includes("woody")) return "木质";
  if (text.includes("花") || text.includes("floral")) return "花香";
  if (text.includes("海") || text.includes("aquatic")) return "水生海洋";
  if (text.includes("柑橘") || text.includes("citrus")) return "柑橘";
  return "待澄清";
}

function inferDominantLayer(goal: string): "Body" | "Structure" {
  const text = goal.toLowerCase();
  if (text.includes("留香") || text.includes("贴肤") || text.includes("基底")) {
    return "Structure";
  }
  return "Body";
}

function inferImpactPolicy(goal: string): "forbidden" | "limited" | "allowed" {
  const text = goal.toLowerCase();
  if (text.includes("不要太刺激") || text.includes("不刺激") || text.includes("柔和开场")) {
    return "forbidden";
  }
  if (text.includes("一点冲击") || text.includes("轻微开场") || text.includes("有一点亮点")) {
    return "limited";
  }
  return "limited";
}

export function deriveIntention(input: PerfumeAgentInput): PerfumeAgentIntention {
  const parsed = perfumeAgentInputSchema.parse(input);
  const conversationText = [parsed.goal, ...parsed.conversation.map((entry) => entry.content)].join(" ");
  const confidenceLevel =
    parsed.conversation.length >= 2 || conversationText.length > 50 ? "medium" : "low";

  return {
    core_theme: inferCoreTheme(conversationText),
    expressive_pool: [],
    dominant_layer: inferDominantLayer(conversationText),
    impact_policy: inferImpactPolicy(conversationText),
    avoid_notes: extractAvoidNotes(conversationText),
    confidence_level: confidenceLevel,
  };
}

export const buildIntentionFromConversationTool: ToolDefinition = {
  id: "build_intention_from_conversation",
  description: "从当前对话与 brief 中提炼香气意向对象。",
  async invoke(input) {
    return deriveIntention(perfumeAgentInputSchema.parse(input));
  },
};
