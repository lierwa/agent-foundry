import { createAgentPackage } from "@agent-foundry/core";
import { runExecutor } from "./executor.js";
import { runPlanner } from "./planner.js";
import { runReviewer } from "./reviewer.js";
import {
  buildCandidatePoolTool,
  buildIntentionFromConversationTool,
  composeStructureLayersTool,
  generateClarificationQuestionTool,
  resolveCategoryCandidatesTool,
  searchNotesTool,
  validateStructureTool,
} from "./tools/index.js";
import { perfumeAgentInputSchema, perfumeAgentOutputSchema } from "./schemas.js";
import { summarizePerfumeResult } from "./summarizer.js";

export const perfumeAgentPackage = createAgentPackage({
  id: "perfume-formulation",
  version: "0.2.0",
  title: "Perfume Intention Agent",
  description: "通过对话逐步生成 intention，动态规划并产出六层香水结构 JSON。",
  inputSchema: perfumeAgentInputSchema,
  outputSchema: perfumeAgentOutputSchema,
  tools: [
    buildIntentionFromConversationTool,
    generateClarificationQuestionTool,
    searchNotesTool,
    resolveCategoryCandidatesTool,
    buildCandidatePoolTool,
    composeStructureLayersTool,
    validateStructureTool,
  ],
  knowledgeProviders: [],
  approvalPolicy: {
    planner: true,
    executor: false,
  },
  reviewPolicy: {
    validateSchema: true,
    requireEvidence: true,
  },
  async createPlan(input, context) {
    return runPlanner(input, context);
  },
  async execute(input, plan, context) {
    return runExecutor(input, plan, context);
  },
  async review(outputDraft, evidence, input, plan, context) {
    return runReviewer(outputDraft, input, plan, context);
  },
  async summarize(result) {
    return summarizePerfumeResult(result);
  },
});
