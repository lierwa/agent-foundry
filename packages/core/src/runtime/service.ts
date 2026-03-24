import {
  approvalEventSchema,
  taskSchema,
  type TaskModelConfig,
  type ApprovalAction,
  type ApprovalEvent,
  type ApprovalRequest,
  type EvidenceItem,
  type Task,
  type TaskResult,
} from "@agent-foundry/shared";
import { createExecutionGraph } from "../graph/execution.js";
import { createPlanningGraph } from "../graph/planning.js";
import { applyPlanPatch } from "./helpers.js";
import type {
  AgentPackage,
  MemoryStore,
  PackageRunContext,
  RuntimeState,
  SessionMemoryState,
  TaskStore,
} from "./types.js";
import { PackageRegistry } from "./registry.js";
import {
  ModelRegistry,
  ModelStructuredOutputError,
  OpenAICompatibleModelService,
} from "./models.js";

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function trace(taskId: string, nodeId: string, eventType: string, payload: Partial<Task["trace"][number]> = {}) {
  return {
    id: id("trace"),
    taskId,
    nodeId,
    eventType,
    timestamp: now(),
    ...payload,
  };
}

function appendPackageTrace(
  taskId: string,
  entries: Array<Omit<Task["trace"][number], "id" | "taskId" | "timestamp">> | undefined,
) {
  return (entries ?? []).map((entry) =>
    trace(taskId, entry.nodeId, entry.eventType, {
      input: entry.input,
      output: entry.output,
      toolCall: entry.toolCall,
      knowledgeCall: entry.knowledgeCall,
      latencyMs: entry.latencyMs,
      model: entry.model,
      error: entry.error,
    }),
  );
}

function tracePlanPatch(taskId: string, patch: Task["plan"] extends infer _T ? any[] : never) {
  return (patch ?? []).map((item) =>
    trace(taskId, "planner", `plan.step_${item.op === "move" ? "reordered" : item.op === "add" ? "added" : item.op === "remove" ? "removed" : "updated"}`, {
      output: item,
    }),
  );
}

function createEmptyState(task: Task): RuntimeState {
  return {
    taskId: task.taskId,
    packageId: task.packageId,
    input: task.inputPayload,
    plan: task.plan,
    currentNode: task.currentNode,
    trace: task.trace,
    pendingApproval: task.pendingApproval,
    approvalHistory: task.approvalHistory,
    status: task.status,
    execution: {
      outputDraft: task.result?.output ?? null,
      evidence: task.result?.evidence ?? [],
      confidence: 1,
      constraints: [],
      reviewNotes: [],
    },
    result: task.result,
  };
}

function withPlanningFeedback(input: unknown, feedback: unknown) {
  if (!feedback || typeof input !== "object" || input === null || Array.isArray(input)) {
    return input;
  }

  return {
    ...(input as Record<string, unknown>),
    pendingPlanningFeedback: feedback,
  };
}

function createEmptySessionMemory(sessionId: string): SessionMemoryState {
  return {
    sessionId,
    facts: {
      core_theme: null,
      expressive_pool: [],
      dominant_layer: null,
      impact_policy: null,
      avoid_notes: [],
    },
    artifacts: {
      intention: null,
      structureDraft: null,
      finalOutput: null,
    },
    history: [],
    updatedAt: now(),
  };
}

export class AgentRuntimeService {
  private readonly activeRuns = new Set<string>();

  constructor(
    private readonly registry: PackageRegistry,
    private readonly taskStore: TaskStore,
    private readonly memoryStore: MemoryStore,
    private readonly modelRegistry?: ModelRegistry,
    private readonly modelService?: OpenAICompatibleModelService,
  ) {}

  listPackages(): AgentPackage[] {
    return this.registry.list();
  }

  listModels(): TaskModelConfig[] {
    return this.modelRegistry?.list() ?? [];
  }

  async listTasks(): Promise<Task[]> {
    return this.taskStore.list();
  }

  async getTask(taskId: string): Promise<Task | null> {
    return this.taskStore.get(taskId);
  }

  async subscribeTask(taskId: string, listener: (task: Task) => void): Promise<() => void> {
    const task = await this.requireTask(taskId);
    listener(task);
    return this.taskStore.subscribe(taskId, listener);
  }

  async getSessionMemory(sessionId: string): Promise<SessionMemoryState> {
    const existing = await this.memoryStore.getSession(sessionId);
    return existing ?? createEmptySessionMemory(sessionId);
  }

  async createTask(packageId: string, input: unknown, modelId?: string, sessionId?: string): Promise<Task> {
    const pkg = this.registry.get(packageId);
    const parsedInput = pkg.inputSchema.parse(input);
    const selectedModel = modelId ? this.requireModel(modelId) : null;
    const task: Task = taskSchema.parse({
      taskId: id("task"),
      sessionId: sessionId ?? null,
      packageId,
      status: "queued",
      currentNode: "planner",
      inputPayload: parsedInput,
      plan: [],
      result: null,
      trace: [],
      pendingApproval: null,
      approvalHistory: [],
      modelConfig: selectedModel,
      memoryRefs: [],
      createdAt: now(),
      updatedAt: now(),
    });

    await this.taskStore.create(task);
    await this.syncSessionMemory(task);
    this.startBackgroundRun(task.taskId, "planning");
    return task;
  }

  async submitApproval(taskId: string, action: ApprovalAction, operator: string, payload?: unknown): Promise<Task> {
    const task = await this.requireTask(taskId);
    if (!task.pendingApproval) {
      throw new Error("Task is not awaiting approval");
    }

    const approvalEvent = approvalEventSchema.parse({
      taskId,
      nodeId: task.pendingApproval.nodeId,
      action,
      operator,
      payload,
      timestamp: now(),
    });

    task.approvalHistory.push(approvalEvent);
    task.trace.push(
      trace(task.taskId, task.pendingApproval.nodeId, "approval.submitted", {
        output: approvalEvent,
      }),
    );
    task.pendingApproval = null;
    task.updatedAt = now();

    if (action === "reject") {
      task.status = "failed";
      task.currentNode = "approval";
      await this.taskStore.update(task);
      await this.syncSessionMemory(task);
      return task;
    }

    if (approvalEvent.nodeId === "planner") {
      task.status = "running";
      task.currentNode = "planner";
      await this.taskStore.update(task);
      await this.syncSessionMemory(task);
      this.startBackgroundRun(task.taskId, "planning");
      return task;
    }

    task.status = "running";
    task.currentNode = "executor";
    await this.taskStore.update(task);
    await this.syncSessionMemory(task);
    this.startBackgroundRun(task.taskId, "execution");
    return task;
  }

  private async runPlanning(task: Task): Promise<Task> {
    const pkg = this.registry.get(task.packageId);
    const planningGraph = createPlanningGraph(async (state) => {
      const startedAt = Date.now();
      const toolTrace: Task["trace"] = [];
        const planContext = this.createPackageContext(
          pkg,
          task.taskId,
          task.modelConfig,
          state.input,
          state.plan,
          state.approvalHistory,
        state.pendingApproval,
        "planner",
        toolTrace,
      );
      const planning = await pkg.createPlan(state.input, planContext);
      const nextPlan =
        planning.planningDecision.replanMode === "none"
          ? state.plan
          : planning.planningDecision.replanMode === "full"
            ? (planning.plan ?? state.plan)
            : applyPlanPatch(state.plan, planning.planPatch ?? []);
      const nextTrace = [
        ...state.trace,
        ...toolTrace,
        ...appendPackageTrace(task.taskId, planning.trace),
        trace(task.taskId, "planner", "planner.re_evaluated", {
          output: planning.planningDecision,
        }),
        ...(planning.planningDecision.replanMode === "partial" ? tracePlanPatch(task.taskId, planning.planPatch ?? []) : []),
        ...(planning.planningDecision.replanMode !== "none"
          ? [
              trace(task.taskId, "planner", "planner.replanned", {
                output: {
                  replanMode: planning.planningDecision.replanMode,
                  reason: planning.planningDecision.reason,
                },
              }),
            ]
          : []),
        trace(task.taskId, "planner", "planner.completed", {
          output: nextPlan,
          latencyMs: Date.now() - startedAt,
        }),
      ];

      if (planning.pendingApproval) {
        const pendingApproval: ApprovalRequest = {
          id: id("approval"),
          taskId: task.taskId,
          nodeId: planning.pendingApproval.nodeId,
          reason: planning.pendingApproval.reason,
          payload: planning.pendingApproval.payload,
          createdAt: now(),
        };
        return {
          input: planning.input ?? state.input,
          plan: nextPlan,
          currentNode: "planner",
          trace: nextTrace,
          pendingApproval,
          status: "awaiting_approval",
        };
      }

      return {
        input: planning.input ?? state.input,
        plan: nextPlan,
        currentNode: "executor",
        trace: nextTrace,
        status: "running",
      };
    });

    const state = await planningGraph.invoke(createEmptyState(task));
    task.inputPayload = state.input;
    task.plan = state.plan;
    task.currentNode = state.currentNode;
    task.status = state.status;
    task.pendingApproval = state.pendingApproval;
    task.trace = state.trace;
    task.updatedAt = now();
    await this.taskStore.update(task);
    await this.syncSessionMemory(task);

    if (task.status === "running") {
      return this.runExecution(task);
    }
    return task;
  }

  private async runExecution(task: Task): Promise<Task> {
    const pkg = this.registry.get(task.packageId);
    const executionGraph = createExecutionGraph({
      executor: async (state) => {
        const startedAt = Date.now();
        const toolTrace: Task["trace"] = [];
        const packageContext = this.createPackageContext(
          pkg,
          task.taskId,
          task.modelConfig,
          state.input,
          state.plan,
          state.approvalHistory,
          state.pendingApproval,
          "executor",
          toolTrace,
        );
        const executed = await pkg.execute(state.input, state.plan, packageContext);
        const nextPlan =
          executed.planPatch && executed.planPatch.length > 0 ? applyPlanPatch(state.plan, executed.planPatch) : (executed.plan ?? state.plan);
        const nextTrace = [
          ...state.trace,
          ...toolTrace,
          ...appendPackageTrace(task.taskId, executed.trace),
          ...(executed.planPatch?.length ? tracePlanPatch(task.taskId, executed.planPatch) : []),
          trace(task.taskId, "executor", "executor.completed", {
            output: {
              confidence: executed.confidence,
              constraints: executed.constraints,
              reviewNotes: executed.reviewNotes,
            },
            knowledgeCall: executed.evidence.map((item) => item.source),
            latencyMs: Date.now() - startedAt,
          }),
        ];

        if (executed.pendingApproval) {
          return {
            currentNode: executed.pendingApproval.nodeId,
            status: "awaiting_approval",
            trace: nextTrace,
            pendingApproval: {
              id: id("approval"),
              taskId: task.taskId,
              nodeId: executed.pendingApproval.nodeId,
              reason: executed.pendingApproval.reason,
              payload: executed.pendingApproval.payload,
              createdAt: now(),
            },
            input: withPlanningFeedback(executed.input ?? state.input, executed.planningFeedback ?? null),
            plan: nextPlan,
            execution: executed,
          };
        }

        if (
          pkg.approvalPolicy.executor &&
          executed.confidence < (pkg.graphConfig?.executorRequiresApprovalWhenConfidenceBelow ?? 0.8)
        ) {
          return {
            currentNode: "executor",
            status: "awaiting_approval",
            trace: nextTrace,
            pendingApproval: {
              id: id("approval"),
              taskId: task.taskId,
              nodeId: "executor",
              reason: "Execution confidence is below threshold and requires operator confirmation.",
              payload: {
                evidence: executed.evidence,
                constraints: executed.constraints,
                outputDraft: executed.outputDraft,
              },
              createdAt: now(),
            },
            input: withPlanningFeedback(executed.input ?? state.input, executed.planningFeedback ?? null),
            plan: nextPlan,
            execution: executed,
          };
        }

        return {
          input: withPlanningFeedback(executed.input ?? state.input, executed.planningFeedback ?? null),
          plan: nextPlan,
          currentNode: "reviewer",
          status: "running",
          trace: nextTrace,
          execution: executed,
        };
      },
      reviewer: async (state) => {
        const startedAt = Date.now();
        const toolTrace: Task["trace"] = [];
        const packageContext = this.createPackageContext(
          pkg,
          task.taskId,
          task.modelConfig,
          state.input,
          state.plan,
          state.approvalHistory,
          state.pendingApproval,
          "reviewer",
          toolTrace,
        );
        const reviewNotes = [...state.execution.reviewNotes];
        const packageReview = pkg.review
          ? await pkg.review(state.execution.outputDraft, state.execution.evidence, state.input, state.plan, packageContext)
          : null;
        if (packageReview) {
          reviewNotes.push(...packageReview.reviewNotes);
        }
        if (pkg.reviewPolicy.requireEvidence && state.execution.evidence.length === 0) {
          reviewNotes.push("At least one evidence item is required.");
        }

        if (pkg.reviewPolicy.validateSchema) {
          pkg.outputSchema.parse(state.execution.outputDraft);
        }

        return {
          input: withPlanningFeedback(state.input, packageReview?.planningFeedback ?? null),
          currentNode: "finalizer",
          trace: [
            ...state.trace,
            ...toolTrace,
            ...appendPackageTrace(task.taskId, packageReview?.trace),
            trace(task.taskId, "reviewer", "reviewer.completed", {
              output: {
                reviewNotes,
                planningFeedback: packageReview?.planningFeedback ?? null,
              },
              latencyMs: Date.now() - startedAt,
            }),
          ],
          execution: {
            ...state.execution,
            reviewNotes,
          },
        };
      },
      finalizer: async (state) => {
        const result: TaskResult = {
          output: state.execution.outputDraft,
          summary: "",
          evidence: state.execution.evidence,
        };
        result.summary = await pkg.summarize(result);

        return {
          currentNode: "finalizer",
          status: "completed",
          result,
          trace: [
            ...state.trace,
            trace(task.taskId, "finalizer", "finalizer.completed", {
              output: result,
            }),
          ],
        };
      },
    });

    const state = await executionGraph.invoke(createEmptyState(task));
    task.inputPayload = state.input;
    task.plan = state.plan;
    task.currentNode = state.currentNode;
    task.status = state.status;
    task.pendingApproval = state.pendingApproval;
    task.trace = state.trace;
    task.result = state.result;
    task.updatedAt = now();
    await this.taskStore.update(task);
    await this.syncSessionMemory(task);

    if (task.status === "completed" && task.result) {
      await this.persistMemory(task, pkg, state.execution.evidence);
    }

    return task;
  }

  private async persistMemory(task: Task, pkg: AgentPackage, evidence: EvidenceItem[]): Promise<void> {
    const structuredId = id("mem");
    const semanticId = id("mem");
    await this.memoryStore.append({
      id: structuredId,
      taskId: task.taskId,
      sessionId: task.sessionId,
      channel: "structured",
      summary: `${pkg.title} task completed`,
      payload: {
        plan: task.plan,
        result: task.result,
        approvals: task.approvalHistory,
      },
      createdAt: now(),
    });
    await this.memoryStore.append({
      id: semanticId,
      taskId: task.taskId,
      sessionId: task.sessionId,
      channel: "semantic",
      summary: task.result?.summary ?? "",
      payload: {
        evidence,
        packageId: task.packageId,
      },
      createdAt: now(),
    });
    task.memoryRefs = [structuredId, semanticId];
    await this.taskStore.update(task);
    await this.syncSessionMemory(task);
  }

  private async requireTask(taskId: string): Promise<Task> {
    const task = await this.taskStore.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return task;
  }

  private requireModel(modelId: string): TaskModelConfig {
    if (!this.modelRegistry) {
      throw new Error("Model registry is not available.");
    }

    const model = this.modelRegistry.get(modelId);
    if (!model) {
      throw new Error(`Model not found or not configured: ${modelId}`);
    }

    return model;
  }

  private startBackgroundRun(taskId: string, phase: "planning" | "execution") {
    if (this.activeRuns.has(taskId)) {
      return;
    }

    this.activeRuns.add(taskId);

    void (async () => {
      try {
        const task = await this.requireTask(taskId);
        if (phase === "planning") {
          await this.runPlanning(task);
        } else {
          await this.runExecution(task);
        }
      } catch (error) {
        await this.failTask(taskId, error);
      } finally {
        this.activeRuns.delete(taskId);
      }
    })();
  }

  private async failTask(taskId: string, error: unknown) {
    const task = await this.taskStore.get(taskId);
    if (!task) {
      return;
    }

    task.status = "failed";
    task.updatedAt = now();
    task.trace.push(
      trace(task.taskId, task.currentNode, "runtime.failed", {
        error: error instanceof Error ? error.message : "Unknown runtime error",
      }),
    );
    await this.taskStore.update(task);
    await this.syncSessionMemory(task);
  }

  private async syncSessionMemory(task: Task): Promise<void> {
    if (!task.sessionId) {
      return;
    }

    const sessionMemory = await this.getSessionMemory(task.sessionId);
    const inputPayload = task.inputPayload as Record<string, unknown>;
    const intention = inputPayload.intention as
      | {
          core_theme?: string | null;
          expressive_pool?: string[];
          dominant_layer?: "Body" | "Structure" | null;
          impact_policy?: "forbidden" | "limited" | "allowed" | null;
          avoid_notes?: string[];
        }
      | null
      | undefined;
    const structureDraft = inputPayload.structureDraft ?? null;
    const finalOutput = task.result?.output ?? null;

    if (intention) {
      sessionMemory.facts = {
        core_theme: intention.core_theme ?? null,
        expressive_pool: intention.expressive_pool ?? [],
        dominant_layer: intention.dominant_layer ?? null,
        impact_policy: intention.impact_policy ?? null,
        avoid_notes: intention.avoid_notes ?? [],
      };
      sessionMemory.artifacts.intention = intention;
    }

    if (structureDraft) {
      sessionMemory.artifacts.structureDraft = structureDraft;
    }

    if (finalOutput) {
      sessionMemory.artifacts.finalOutput = finalOutput;
    }

    const historyEntry = {
      taskId: task.taskId,
      summary: task.result?.summary ?? `${task.currentNode} / ${task.status}`,
      updatedAt: task.updatedAt,
      status: task.status,
    };
    const existingIndex = sessionMemory.history.findIndex((entry) => entry.taskId === task.taskId);
    if (existingIndex >= 0) {
      sessionMemory.history[existingIndex] = historyEntry;
    } else {
      sessionMemory.history.unshift(historyEntry);
    }
    sessionMemory.history = sessionMemory.history.slice(0, 10);
    sessionMemory.updatedAt = now();

    await this.memoryStore.putSession(task.sessionId, sessionMemory);
  }

  private createPackageContext(
    pkg: AgentPackage,
    taskId: string,
    selectedModel: TaskModelConfig | null,
    input: unknown,
    plan: RuntimeState["plan"],
    approvalHistory: RuntimeState["approvalHistory"],
    pendingApproval: RuntimeState["pendingApproval"],
    currentNode: string,
    toolTraceCollector: Task["trace"],
  ): PackageRunContext {
    return {
      taskId,
      packageId: pkg.id,
      input,
      plan,
      approvalHistory,
      pendingApproval,
      selectedModel,
      invokeTool: async (toolId, toolInput) => {
        const tool = pkg.tools.find((entry) => entry.id === toolId);
        if (!tool) {
          throw new Error(`Unknown tool "${toolId}" for package ${pkg.id}`);
        }
        toolTraceCollector.push(
          trace(taskId, currentNode, "tool.called", {
            toolCall: {
              toolId,
              input: toolInput,
            },
          }),
        );

        try {
          const output = await tool.invoke(toolInput, {
            taskId,
            packageId: pkg.id,
            currentNode,
          });
          toolTraceCollector.push(
            trace(taskId, currentNode, "tool.completed", {
              toolCall: {
                toolId,
              },
              output,
            }),
          );
          return output;
        } catch (error) {
          toolTraceCollector.push(
            trace(taskId, currentNode, "tool.failed", {
              toolCall: {
                toolId,
              },
              error: error instanceof Error ? error.message : "Unknown tool error",
            }),
          );
          throw error;
        }
      },
      generateObject: async ({ schema, prompt, systemPrompt, temperature }) => {
        if (!selectedModel || !this.modelService) {
          throw new Error("No model selected for this task.");
        }

        const startedAt = Date.now();
        toolTraceCollector.push(
          trace(taskId, currentNode, "model.called", {
            model: selectedModel.id,
            output: {
              provider: selectedModel.provider,
            },
          }),
        );

        try {
          const result = await this.modelService.generateObject({
            modelId: selectedModel.id,
            schema,
            messages: [
              ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
              { role: "user" as const, content: prompt },
            ],
            temperature,
          });
          toolTraceCollector.push(
            trace(taskId, currentNode, "model.completed", {
              model: result.model.id,
              latencyMs: Date.now() - startedAt,
              output: {
                provider: result.model.provider,
                label: result.model.label,
              },
            }),
          );
          return result.object;
        } catch (error) {
          const debugOutput =
            error instanceof ModelStructuredOutputError
              ? {
                  provider: error.provider,
                  rawText: error.rawText,
                  parseError: error.parseError,
                }
              : undefined;
          toolTraceCollector.push(
            trace(taskId, currentNode, "model.failed", {
              model: selectedModel.id,
              output: debugOutput,
              error: error instanceof Error ? error.message : "Unknown model error",
            }),
          );
          throw error;
        }
      },
    };
  }
}
