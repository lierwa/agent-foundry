import {
  approvalEventSchema,
  taskSchema,
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
  TaskStore,
} from "./types.js";
import { PackageRegistry } from "./registry.js";

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

export class AgentRuntimeService {
  constructor(
    private readonly registry: PackageRegistry,
    private readonly taskStore: TaskStore,
    private readonly memoryStore: MemoryStore,
  ) {}

  listPackages(): AgentPackage[] {
    return this.registry.list();
  }

  async listTasks(): Promise<Task[]> {
    return this.taskStore.list();
  }

  async getTask(taskId: string): Promise<Task | null> {
    return this.taskStore.get(taskId);
  }

  async createTask(packageId: string, input: unknown): Promise<Task> {
    const pkg = this.registry.get(packageId);
    const parsedInput = pkg.inputSchema.parse(input);
    const task: Task = taskSchema.parse({
      taskId: id("task"),
      packageId,
      status: "queued",
      currentNode: "planner",
      inputPayload: parsedInput,
      plan: [],
      result: null,
      trace: [],
      pendingApproval: null,
      approvalHistory: [],
      memoryRefs: [],
      createdAt: now(),
      updatedAt: now(),
    });

    await this.taskStore.create(task);
    return this.runPlanning(task);
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
      return task;
    }

    if (approvalEvent.nodeId === "planner") {
      task.status = "running";
      task.currentNode = "planner";
      await this.taskStore.update(task);
      return this.runPlanning(task);
    }

    task.status = "running";
    task.currentNode = "executor";
    await this.taskStore.update(task);
    return this.runExecution(task);
  }

  private async runPlanning(task: Task): Promise<Task> {
    const pkg = this.registry.get(task.packageId);
    const planningGraph = createPlanningGraph(async (state) => {
      const startedAt = Date.now();
      const toolTrace: Task["trace"] = [];
      const planContext = this.createPackageContext(
        pkg,
        task.taskId,
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
  }

  private async requireTask(taskId: string): Promise<Task> {
    const task = await this.taskStore.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return task;
  }

  private createPackageContext(
    pkg: AgentPackage,
    taskId: string,
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
    };
  }
}
