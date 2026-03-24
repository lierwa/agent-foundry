import { z } from "zod";

export const taskStatusSchema = z.enum([
  "queued",
  "running",
  "awaiting_approval",
  "completed",
  "failed",
]);

export const approvalActionSchema = z.enum(["approve", "reject", "revise"]);

export const traceEventSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  nodeId: z.string(),
  eventType: z.string(),
  timestamp: z.string(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  toolCall: z.unknown().optional(),
  knowledgeCall: z.unknown().optional(),
  latencyMs: z.number().optional(),
  model: z.string().optional(),
  error: z.string().optional(),
});

export const approvalRequestSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  nodeId: z.string(),
  reason: z.string(),
  payload: z.unknown().optional(),
  createdAt: z.string(),
});

export const approvalEventSchema = z.object({
  taskId: z.string(),
  nodeId: z.string(),
  action: approvalActionSchema,
  operator: z.string(),
  payload: z.unknown().optional(),
  timestamp: z.string(),
});

export const planStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  objective: z.string(),
  status: z.enum(["pending", "ready", "done", "blocked"]),
  kind: z.string().default("task"),
  source: z.string().default("planner"),
});

export const replanModeSchema = z.enum(["none", "partial", "full"]);

export const planPatchItemSchema = z.object({
  op: z.enum(["add", "update", "remove", "move"]),
  stepId: z.string(),
  step: planStepSchema.optional(),
  afterStepId: z.string().nullable().optional(),
  index: z.number().int().nonnegative().optional(),
});

export const planningDecisionSchema = z.object({
  phase: z.enum(["initial", "approval", "execution_feedback", "review_feedback", "tool_feedback"]),
  replanMode: replanModeSchema,
  reason: z.string(),
  affectedSteps: z.array(z.string()).default([]),
});

export const planningFeedbackSchema = z.object({
  source: z.enum(["planner", "executor", "reviewer", "tool"]),
  reason: z.string(),
  suggestedReplanMode: replanModeSchema.default("partial"),
  details: z.unknown().optional(),
});

export const evidenceItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  source: z.string(),
  confidence: z.number(),
  constraints: z.array(z.string()).default([]),
});

export const knowledgeResultSchema = z.object({
  items: z.array(evidenceItemSchema),
  source: z.string(),
  evidence: z.array(z.string()),
  confidence: z.number(),
  constraints: z.array(z.string()),
});

export const perfumeTaskInputSchema = z.object({
  goal: z.string(),
  conversation: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    }),
  ).default([]),
});

export const perfumeIntentionSchema = z.object({
  core_theme: z.string().nullable(),
  expressive_pool: z.array(z.string()).default([]),
  dominant_layer: z.enum(["Body", "Structure"]).nullable(),
  impact_policy: z.enum(["forbidden", "limited", "allowed"]),
  avoid_notes: z.array(z.string()).default([]),
  confidence_level: z.enum(["high", "medium", "low"]),
});

export const clarificationQuestionSchema = z.object({
  key: z.string(),
  decisionKey: z.string(),
  question: z.string(),
  multiple: z.boolean().default(false),
  options: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    }),
  ).default([]),
  allowsFreeText: z.boolean().default(true),
});

export const perfumeMaterialCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["top", "middle", "base"]),
  families: z.array(z.string()).default([]),
  volatility: z.string().optional(),
  impact_level: z.string().optional(),
  structural_power: z.number().optional(),
  reasoning: z.string().optional(),
});

export const perfumeMaterialCandidateSetSchema = z.object({
  top: z.array(perfumeMaterialCandidateSchema).default([]),
  middle: z.array(perfumeMaterialCandidateSchema).default([]),
  base: z.array(perfumeMaterialCandidateSchema).default([]),
});

export const perfumeStructureLayersSchema = z.object({
  Impact: z.array(z.string()).default([]),
  Buffer: z.array(z.string()).default([]),
  Body: z.array(z.string()).default([]),
  Bridge: z.array(z.string()).default([]),
  Structure: z.array(z.string()).default([]),
  Fix: z.array(z.string()).default([]),
});

export const perfumeCandidatePoolRequestSchema = z.object({
  goal: z.string(),
  intention: perfumeIntentionSchema.nullable().default(null),
  approval: z
    .object({
      selections: z.array(z.string()).default([]),
      note: z.string().nullable().default(null),
    })
    .nullable()
    .default(null),
  previousStructure: perfumeStructureLayersSchema.nullable().default(null),
});

export const perfumeTaskStateSchema = perfumeTaskInputSchema.extend({
  intention: perfumeIntentionSchema.nullable().default(null),
  candidatePool: perfumeMaterialCandidateSetSchema.nullable().default(null),
  clarification: clarificationQuestionSchema.nullable().default(null),
  planningContext: z
    .object({
      cycle: z.number().int().nonnegative().default(0),
      lastEvent: z.string().nullable().default(null),
    })
    .default({ cycle: 0, lastEvent: null }),
  lastPlanningDecision: planningDecisionSchema.nullable().default(null),
  pendingPlanningFeedback: planningFeedbackSchema.nullable().default(null),
  structureDraft: perfumeStructureLayersSchema.nullable().default(null),
});

export const perfumeStructureOutputSchema = perfumeStructureLayersSchema;

export const taskModelConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: z.string(),
  model: z.string(),
});

export const taskResultSchema = z.object({
  output: z.unknown(),
  summary: z.string(),
  evidence: z.array(evidenceItemSchema).default([]),
});

export const taskSchema = z.object({
  taskId: z.string(),
  sessionId: z.string().nullable().default(null),
  packageId: z.string(),
  status: taskStatusSchema,
  currentNode: z.string(),
  inputPayload: z.unknown(),
  plan: z.array(planStepSchema),
  result: taskResultSchema.nullable(),
  trace: z.array(traceEventSchema),
  pendingApproval: approvalRequestSchema.nullable(),
  approvalHistory: z.array(approvalEventSchema),
  modelConfig: taskModelConfigSchema.nullable().default(null),
  memoryRefs: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createTaskSchema = z.object({
  packageId: z.string(),
  input: z.unknown(),
  modelId: z.string().optional(),
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type ApprovalAction = z.infer<typeof approvalActionSchema>;
export type TraceEvent = z.infer<typeof traceEventSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type ApprovalEvent = z.infer<typeof approvalEventSchema>;
export type PlanStep = z.infer<typeof planStepSchema>;
export type ReplanMode = z.infer<typeof replanModeSchema>;
export type PlanPatchItem = z.infer<typeof planPatchItemSchema>;
export type PlanningDecision = z.infer<typeof planningDecisionSchema>;
export type PlanningFeedback = z.infer<typeof planningFeedbackSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type KnowledgeResult = z.infer<typeof knowledgeResultSchema>;
export type PerfumeTaskInput = z.infer<typeof perfumeTaskInputSchema>;
export type PerfumeIntention = z.infer<typeof perfumeIntentionSchema>;
export type ClarificationQuestion = z.infer<typeof clarificationQuestionSchema>;
export type PerfumeMaterialCandidate = z.infer<typeof perfumeMaterialCandidateSchema>;
export type PerfumeMaterialCandidateSet = z.infer<typeof perfumeMaterialCandidateSetSchema>;
export type PerfumeStructureLayers = z.infer<typeof perfumeStructureLayersSchema>;
export type PerfumeCandidatePoolRequest = z.infer<typeof perfumeCandidatePoolRequestSchema>;
export type PerfumeTaskState = z.infer<typeof perfumeTaskStateSchema>;
export type PerfumeStructureOutput = z.infer<typeof perfumeStructureOutputSchema>;
export type TaskModelConfig = z.infer<typeof taskModelConfigSchema>;
export type TaskResult = z.infer<typeof taskResultSchema>;
export type Task = z.infer<typeof taskSchema>;
export type CreateTask = z.infer<typeof createTaskSchema>;
