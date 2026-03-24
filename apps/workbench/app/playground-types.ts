export type PlaygroundTaskStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed";

export type PlaygroundApprovalAction = "approve" | "reject" | "revise";

export type PlaygroundTraceEvent = {
  id: string;
  taskId: string;
  nodeId: string;
  eventType: string;
  timestamp: string;
  input?: unknown;
  output?: unknown;
  toolCall?: unknown;
  knowledgeCall?: unknown;
  latencyMs?: number;
  model?: string;
  error?: string;
};

export type PlaygroundApprovalRequest = {
  id: string;
  taskId: string;
  nodeId: string;
  reason: string;
  payload?: unknown;
  createdAt: string;
};

export type PlaygroundApprovalEvent = {
  taskId: string;
  nodeId: string;
  action: PlaygroundApprovalAction;
  operator: string;
  payload?: unknown;
  timestamp: string;
};

export type PlaygroundPlanStep = {
  id: string;
  title: string;
  objective: string;
  status: "pending" | "ready" | "done" | "blocked";
  kind?: string;
  source?: string;
};

export type PlaygroundTaskResult = {
  output: unknown;
  summary: string;
  evidence: Array<{
    id: string;
    title: string;
    content: string;
    source: string;
    confidence: number;
    constraints?: string[];
  }>;
};

export type PlaygroundModelOption = {
  id: string;
  label: string;
  provider: string;
  model: string;
};

export type PlaygroundApprovalOption = {
  label: string;
  value: string;
};

export type PlaygroundTask = {
  taskId: string;
  packageId: string;
  status: PlaygroundTaskStatus;
  currentNode: string;
  modelConfig: PlaygroundModelOption | null;
  inputPayload: {
    goal?: string;
    conversation?: Array<{
      role: "user" | "assistant" | "system";
      content: string;
    }>;
    intention?: {
      core_theme: string | null;
      expressive_pool: string[];
      dominant_layer: "Body" | "Structure" | null;
      impact_policy: "forbidden" | "limited" | "allowed";
      avoid_notes: string[];
      confidence_level: "high" | "medium" | "low";
    } | null;
    candidatePool?: {
      top: Array<{ id: string; name: string; category: string }>;
      middle: Array<{ id: string; name: string; category: string }>;
      base: Array<{ id: string; name: string; category: string }>;
    } | null;
    clarification?: {
      key: string;
      decisionKey: string;
      question: string;
      multiple: boolean;
      options: Array<{ label: string; value: string }>;
      allowsFreeText: boolean;
    } | null;
    planningContext?: {
      cycle: number;
      lastEvent: string | null;
    };
    lastPlanningDecision?: {
      phase: "initial" | "approval" | "execution_feedback" | "review_feedback" | "tool_feedback";
      replanMode: "none" | "partial" | "full";
      reason: string;
      affectedSteps: string[];
    } | null;
    pendingPlanningFeedback?: {
      source: "planner" | "executor" | "reviewer" | "tool";
      reason: string;
      suggestedReplanMode: "none" | "partial" | "full";
      details?: unknown;
    } | null;
    structureDraft?: {
      Impact: string[];
      Buffer: string[];
      Body: string[];
      Bridge: string[];
      Structure: string[];
      Fix: string[];
    } | null;
    [key: string]: unknown;
  };
  plan: PlaygroundPlanStep[];
  result: PlaygroundTaskResult | null;
  trace: PlaygroundTraceEvent[];
  pendingApproval: PlaygroundApprovalRequest | null;
  approvalHistory: PlaygroundApprovalEvent[];
  memoryRefs: string[];
  createdAt: string;
  updatedAt: string;
};

export type PlaygroundSessionMemory = {
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
    status: PlaygroundTaskStatus;
  }>;
};

export type PlaygroundSessionHistoryMessage = {
  id: string;
  taskId: string | null;
  kind: "user" | "assistant" | "error";
  body: string;
  createdAt: string;
};

export type PlaygroundSession = {
  sessionId: string;
  packageId: string;
  task: PlaygroundTask | null;
  historyMessages: PlaygroundSessionHistoryMessage[];
  sessionMemory: PlaygroundSessionMemory;
  createdAt: string;
  updatedAt: string;
};

export type TimelineFilter =
  | "all"
  | "approval"
  | "planning"
  | "execution"
  | "review"
  | "errors";

export type PlaygroundApprovalViewModel = {
  id: string;
  question: string;
  reason: string;
  multiple: boolean;
  allowsFreeText: boolean;
  options: PlaygroundApprovalOption[];
  nodeId: string;
  contextCards: Array<{
    label: string;
    body: string;
  }>;
};

export type BriefDraft = {
  goal: string;
};

export type InspectorFocus =
  | { type: "task"; label: string; data: unknown }
  | { type: "step"; label: string; data: unknown }
  | { type: "event"; label: string; data: unknown }
  | { type: "result"; label: string; data: unknown };

export type InspectorTab = "intention" | "structure" | "output" | "memory";

export type PlanListItem = {
  id: string;
  title: string;
  status: PlaygroundPlanStep["status"];
  isActive: boolean;
};

export type WorkbenchLayoutState = {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  planCollapsed: boolean;
};
