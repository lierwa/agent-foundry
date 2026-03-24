import type {
  ApprovalEvent,
  ApprovalRequest,
  EvidenceItem,
  KnowledgeResult,
  PlanStep,
  PlanPatchItem,
  PlanningDecision,
  PlanningFeedback,
  TaskModelConfig,
  TraceEvent,
  Task,
  TaskResult,
} from "@agent-foundry/shared";
import type { ZodTypeAny } from "zod";

export type GraphPhase = "planning" | "execution" | "review" | "finalization";

export type ChatModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface ToolContext {
  taskId: string;
  packageId: string;
  currentNode: string;
}

export interface ToolDefinition {
  id: string;
  description: string;
  invoke(input: unknown, context: ToolContext): Promise<unknown>;
}

export interface KnowledgeProvider {
  id: string;
  description: string;
  search(query: string, context: ToolContext, constraints?: string[]): Promise<KnowledgeResult>;
}

export interface MemoryRecord {
  id: string;
  taskId: string;
  sessionId?: string | null;
  channel: "structured" | "semantic";
  summary: string;
  payload: unknown;
  createdAt: string;
}

export interface SessionMemoryState {
  sessionId: string;
  facts: {
    core_theme: string | null;
    expressive_pool: string[];
    dominant_layer: "Body" | "Structure" | null;
    impact_policy: "forbidden" | "limited" | "allowed" | null;
    avoid_notes: string[];
  };
  artifacts: {
    intention: unknown | null;
    structureDraft: unknown | null;
    finalOutput: unknown | null;
  };
  history: Array<{
    taskId: string;
    summary: string;
    updatedAt: string;
    status: Task["status"];
  }>;
  updatedAt: string;
}

export interface StoredTaskRecord {
  taskId: string;
  createdAt: string;
  updatedAt: string;
  task: Task;
}

export type StoredMemoryRecord = MemoryRecord;

export interface MemoryStore {
  append(record: MemoryRecord): Promise<void>;
  listByTask(taskId: string): Promise<MemoryRecord[]>;
  getSession(sessionId: string): Promise<SessionMemoryState | null>;
  putSession(sessionId: string, memory: SessionMemoryState): Promise<void>;
}

export interface TaskStore {
  create(task: Task): Promise<void>;
  update(task: Task): Promise<void>;
  get(taskId: string): Promise<Task | null>;
  list(): Promise<Task[]>;
  subscribe(taskId: string, listener: (task: Task) => void): Promise<() => void>;
}

export interface PackageRunContext {
  taskId: string;
  packageId: string;
  input: unknown;
  plan: PlanStep[];
  approvalHistory: ApprovalEvent[];
  pendingApproval: ApprovalRequest | null;
  selectedModel: TaskModelConfig | null;
  invokeTool(toolId: string, input: unknown): Promise<unknown>;
  generateObject(options: {
    schema: ZodTypeAny;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
  }): Promise<unknown>;
}

export interface PendingApprovalDraft {
  nodeId: string;
  reason: string;
  payload?: unknown;
}

export interface PackagePlannerResult {
  plan?: PlanStep[];
  planPatch?: PlanPatchItem[];
  input?: unknown;
  pendingApproval?: PendingApprovalDraft | null;
  planningDecision: PlanningDecision;
  trace?: Array<Omit<TraceEvent, "id" | "taskId" | "timestamp">>;
}

export interface PackageExecutionResult {
  outputDraft: unknown;
  evidence: EvidenceItem[];
  confidence: number;
  constraints: string[];
  reviewNotes: string[];
  plan?: PlanStep[];
  planPatch?: PlanPatchItem[];
  input?: unknown;
  pendingApproval?: PendingApprovalDraft | null;
  planningFeedback?: PlanningFeedback | null;
  trace?: Array<Omit<TraceEvent, "id" | "taskId" | "timestamp">>;
}

export interface PackageReviewResult {
  reviewNotes: string[];
  planningFeedback?: PlanningFeedback | null;
  trace?: Array<Omit<TraceEvent, "id" | "taskId" | "timestamp">>;
}

export interface CreateAgentPackageConfig
  extends Omit<AgentPackage, "review" | "summarize"> {
  review?: AgentPackage["review"];
  summarize?: AgentPackage["summarize"];
}

export interface AgentPackage {
  id: string;
  version: string;
  title: string;
  description: string;
  inputSchema: ZodTypeAny;
  outputSchema: ZodTypeAny;
  tools: ToolDefinition[];
  knowledgeProviders: KnowledgeProvider[];
  graphConfig?: {
    plannerRequiresApproval?: boolean;
    executorRequiresApprovalWhenConfidenceBelow?: number;
  };
  approvalPolicy: {
    planner: boolean;
    executor: boolean;
  };
  reviewPolicy: {
    validateSchema: boolean;
    requireEvidence: boolean;
  };
  createPlan(input: unknown, context: PackageRunContext): Promise<PackagePlannerResult>;
  execute(input: unknown, plan: PlanStep[], context: PackageRunContext): Promise<PackageExecutionResult>;
  review?(
    outputDraft: unknown,
    evidence: EvidenceItem[],
    input: unknown,
    plan: PlanStep[],
    context: PackageRunContext,
  ): Promise<PackageReviewResult>;
  summarize(result: TaskResult): Promise<string>;
}

export interface RuntimeState {
  taskId: string;
  packageId: string;
  input: unknown;
  plan: PlanStep[];
  currentNode: string;
  trace: Task["trace"];
  pendingApproval: ApprovalRequest | null;
  approvalHistory: ApprovalEvent[];
  status: Task["status"];
  execution: {
    outputDraft: unknown | null;
    evidence: EvidenceItem[];
    confidence: number;
    constraints: string[];
    reviewNotes: string[];
  };
  result: TaskResult | null;
  error?: string;
}
