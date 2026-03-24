import type { ToolDefinition } from "@agent-foundry/core";
import type { PerfumeAgentClarification, PerfumeAgentIntention } from "../schemas.js";

export function buildClarificationQuestion(intention: PerfumeAgentIntention): PerfumeAgentClarification | null {
  if (!intention.core_theme || intention.core_theme === "待澄清") {
    return {
      key: "core_theme",
      decisionKey: "core_theme",
      question: "你更想把这支香水做成哪种主方向？",
      multiple: false,
      options: [
        { label: "木质", value: "木质" },
        { label: "花香", value: "花香" },
        { label: "柑橘", value: "柑橘" },
        { label: "水生海洋", value: "水生海洋" },
      ],
      allowsFreeText: true,
    };
  }

  if (intention.expressive_pool.length === 0) {
    return {
      key: "expressive_pool",
      decisionKey: "expressive_pool",
      question: "你希望主体表达更靠近哪些香材或气味方向？",
      multiple: true,
      options: [
        { label: "木质", value: "木质" },
        { label: "冷感木质", value: "冷感木质" },
        { label: "白花", value: "白花" },
        { label: "茶香", value: "茶香" },
        { label: "柑橘类", value: "柑橘类" },
      ],
      allowsFreeText: true,
    };
  }

  if (intention.impact_policy === "limited" && intention.confidence_level === "low") {
    return {
      key: "impact_policy",
      decisionKey: "impact_policy",
      question: "你希望这支香水的开场更克制，还是允许一点有控制的前调亮点？",
      multiple: false,
      options: [
        { label: "尽量克制，不要刺激", value: "forbidden" },
        { label: "可以轻微提亮，但要有控制", value: "limited" },
        { label: "允许明显的前调冲击", value: "allowed" },
      ],
      allowsFreeText: true,
    };
  }

  return null;
}

export const generateClarificationQuestionTool: ToolDefinition = {
  id: "generate_clarification_question",
  description: "基于当前意向对象生成下一轮澄清问题。",
  async invoke(input) {
    return buildClarificationQuestion(input as PerfumeAgentIntention);
  },
};
