import {
  ModelRequestError,
  ModelStructuredOutputError,
  type PackageRunContext,
} from "@agent-foundry/core";
import {
  perfumeAgentClarificationSchema,
  perfumeAgentIntentionSchema,
  perfumeAgentOutputSchema,
  type PerfumeAgentCandidateSet,
  type PerfumeAgentInput,
} from "./schemas.js";
import { z } from "zod";

const plannerArtifactsSchema = z.object({
  intention: perfumeAgentIntentionSchema,
  clarification: perfumeAgentClarificationSchema.nullable(),
});

type PlannerArtifacts = z.infer<typeof plannerArtifactsSchema>;

function formatModelError(nodeId: "planner" | "executor", context: PackageRunContext, error: unknown) {
  const modelLabel = context.selectedModel?.id ?? "unknown-model";

  if (error instanceof ModelStructuredOutputError) {
    return new Error(
      `[${nodeId}] 模型 ${modelLabel} 返回了无法通过契约校验的 JSON。parseError: ${error.parseError}`,
    );
  }

  if (error instanceof ModelRequestError) {
    return new Error(`[${nodeId}] 模型 ${modelLabel} 请求失败：${error.message}`);
  }

  if (error instanceof Error) {
    return new Error(`[${nodeId}] 模型 ${modelLabel} 执行失败：${error.message}`);
  }

  return new Error(`[${nodeId}] 模型 ${modelLabel} 执行失败。`);
}

export async function generatePlannerArtifacts(
  context: PackageRunContext,
  prompt: string,
): Promise<PlannerArtifacts> {
  if (!context.selectedModel) {
    throw new Error("[planner] 当前任务没有选择模型，无法生成结构化 planner artifacts。");
  }

  try {
    const raw = await context.generateObject({
      schema: plannerArtifactsSchema,
      systemPrompt: [
        "你是一名资深香氛策划师。",
        "你必须基于用户 brief 和对话，输出一个且仅一个合法 JSON 对象。",
        "如果信息足够，请输出完整 intention，并令 clarification 为 null。",
        "如果信息不足，请仍然输出完整 intention，同时输出唯一一个最高价值的 clarification 问题。",
        "绝不允许省略 intention 的任何字段；impact_policy 必须明确为 forbidden、limited 或 allowed。",
        "禁止输出 Markdown、代码块、解释、前后缀文本。",
      ].join(" "),
      prompt,
      temperature: 0.15,
    });

    return plannerArtifactsSchema.parse(raw);
  } catch (error) {
    throw formatModelError("planner", context, error);
  }
}

export async function generateStructureDraft(
  context: PackageRunContext,
  prompt: string,
): Promise<ReturnType<typeof perfumeAgentOutputSchema.parse>> {
  if (!context.selectedModel) {
    throw new Error("[executor] 当前任务没有选择模型，无法生成六层结构。");
  }

  try {
    const raw = await context.generateObject({
      schema: perfumeAgentOutputSchema,
      systemPrompt: [
        "你是一名资深结构调香师。",
        "你必须基于 intention 与候选池输出一个完整合法的六层结构 JSON。",
        "只能输出六层结构对象本身，不允许再包一层 output。",
        "只能选择候选池中已有的香材 id。",
        "禁止输出 Markdown、代码块、解释、前后缀文本。",
      ].join(" "),
      prompt,
      temperature: 0.2,
    });

    return perfumeAgentOutputSchema.parse(raw);
  } catch (error) {
    throw formatModelError("executor", context, error);
  }
}

export function buildStructureEvidenceSource(
  input: PerfumeAgentInput,
  candidatePool: PerfumeAgentCandidateSet,
) {
  return {
    goal: input.goal,
    conversation: input.conversation,
    candidatePool,
  };
}
