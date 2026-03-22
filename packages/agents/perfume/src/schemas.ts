import { z } from "zod";
import {
  clarificationQuestionSchema,
  perfumeIntentionSchema,
  perfumeMaterialCandidateSetSchema,
  perfumeMaterialCandidateSchema,
  perfumeStructureOutputSchema,
  perfumeTaskInputSchema,
  perfumeTaskStateSchema,
} from "@agent-foundry/shared";

export const perfumeAgentInputSchema = perfumeTaskInputSchema;
export const perfumeAgentStateSchema = perfumeTaskStateSchema;
export const perfumeAgentIntentionSchema = perfumeIntentionSchema;
export const perfumeAgentCandidateSchema = perfumeMaterialCandidateSchema;
export const perfumeAgentCandidateSetSchema = perfumeMaterialCandidateSetSchema;
export const perfumeAgentClarificationSchema = clarificationQuestionSchema;
export const perfumeAgentOutputSchema = perfumeStructureOutputSchema;

export const perfumeAgentPlannerSnapshotSchema = z.object({
  prompt: z.string(),
  intention: perfumeAgentIntentionSchema.nullable(),
  candidatePool: perfumeAgentCandidateSetSchema.nullable(),
  clarification: perfumeAgentClarificationSchema.nullable(),
});

export type PerfumeAgentInput = z.infer<typeof perfumeAgentInputSchema>;
export type PerfumeAgentState = z.infer<typeof perfumeAgentStateSchema>;
export type PerfumeAgentIntention = z.infer<typeof perfumeAgentIntentionSchema>;
export type PerfumeAgentCandidate = z.infer<typeof perfumeAgentCandidateSchema>;
export type PerfumeAgentCandidateSet = z.infer<typeof perfumeAgentCandidateSetSchema>;
export type PerfumeAgentClarification = z.infer<typeof perfumeAgentClarificationSchema>;
export type PerfumeAgentOutput = z.infer<typeof perfumeAgentOutputSchema>;
