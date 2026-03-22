import { createAgentPackage } from "@agent-foundry/core";
import { runWardrobeExecutor } from "./executor.js";
import { runWardrobePlanner } from "./planner.js";
import { runWardrobeReviewer } from "./reviewer.js";
import { wardrobeTaskInputSchema, wardrobeTaskOutputSchema } from "./schemas.js";
import { summarizeWardrobeResult } from "./summarizer.js";

export const wardrobeAgentPackage = createAgentPackage({
  id: "wardrobe-agent",
  version: "0.1.0",
  title: "Wardrobe Agent",
  description: "完整模板下的最小 wardrobe agent 示例。",
  inputSchema: wardrobeTaskInputSchema,
  outputSchema: wardrobeTaskOutputSchema,
  tools: [],
  knowledgeProviders: [],
  approvalPolicy: {
    planner: false,
    executor: false,
  },
  reviewPolicy: {
    validateSchema: true,
    requireEvidence: true,
  },
  async createPlan(input, context) {
    return runWardrobePlanner(input, context);
  },
  async execute(input, plan, context) {
    return runWardrobeExecutor(input, plan, context);
  },
  review: runWardrobeReviewer,
  summarize: summarizeWardrobeResult,
});
