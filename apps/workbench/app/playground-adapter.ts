import type {
  InspectorFocus,
  InspectorTab,
  PlanListItem,
  PlaygroundApprovalOption,
  PlaygroundApprovalViewModel,
  PlaygroundSession,
  PlaygroundTask,
  PlaygroundTraceEvent,
  TimelineFilter,
} from "./playground-types";

export function createDefaultBrief() {
  return {
    goal: "我想做一款适合春季上新的木质调香水，前段不要太刺激，但需要结构成立。",
  };
}

export function buildPlanList(session: PlaygroundSession | null): PlanListItem[] {
  const task = session?.task ?? null;
  if (!task) {
    return [];
  }

  const activeStepId =
    task.plan.find((step) => step.status === "ready")?.id ??
    task.plan.find((step) => step.status === "pending")?.id ??
    null;

  return task.plan.map((step) => ({
    id: step.id,
    title: humanizePlanTitle(step.title, step.objective),
    status: step.status,
    isActive: step.id === activeStepId,
  }));
}

function humanizePlanTitle(title: string, objective: string) {
  const raw = `${title} ${objective}`.toLowerCase();

  if (raw.includes("意向") || raw.includes("intention")) {
    return "归纳用户意图与结构方向";
  }
  if (raw.includes("候选池") || raw.includes("candidate")) {
    return "构建候选香材池";
  }
  if (raw.includes("六层") || raw.includes("structure")) {
    return "生成六层结构草案";
  }
  if (raw.includes("审校") || raw.includes("review")) {
    return "审校结构与约束";
  }

  return title;
}

export function buildApprovalOptions(task: PlaygroundTask): PlaygroundApprovalViewModel | null {
  if (!task.pendingApproval) {
    return null;
  }

  const payload = task.pendingApproval.payload as
    | {
        options?: Array<string | { label?: string; value?: string }>;
        multiple?: boolean;
        question?: string;
        decisionKey?: string;
        allowsFreeText?: boolean;
      }
    | undefined;

  const options = payload?.options?.length
    ? payload.options.map((item, index) =>
        typeof item === "string"
          ? { label: item, value: item }
          : {
              label: item.label ?? item.value ?? `选项 ${index + 1}`,
              value: item.value ?? item.label ?? `option-${index + 1}`,
            },
      )
    : defaultApprovalOptions(task.pendingApproval.nodeId);

  return {
    id: task.pendingApproval.id,
    question: payload?.question ?? resolveApprovalQuestion(task),
    reason: task.pendingApproval.reason,
    multiple: Boolean(payload?.multiple),
    allowsFreeText: payload?.allowsFreeText ?? true,
    options,
    nodeId: task.pendingApproval.nodeId,
    contextCards: buildApprovalContext(task),
  };
}

function buildApprovalContext(task: PlaygroundTask): Array<{ label: string; body: string }> {
  const activeStep =
    task.plan.find((step) => step.status === "ready") ??
    task.plan.find((step) => step.status === "pending") ??
    null;
  const stageLabel = activeStep ? `当前步骤是「${activeStep.title}」` : `当前节点是 ${formatNode(task.currentNode)}`;
  const nextNodeLabel =
    task.pendingApproval?.nodeId === "planner"
      ? "提交后我会把你的输入并入当前规划上下文，再决定是继续澄清还是进入执行。"
      : "提交后我会把你的输入写回当前任务，并继续推进后续执行或审校。";

  return [
    {
      label: "为什么现在停在这里",
      body: `${stageLabel}。${task.pendingApproval?.reason ?? "当前阶段缺少必要输入"}，所以我需要先得到明确反馈。`,
    },
    {
      label: "你提交之后会发生什么",
      body: nextNodeLabel,
    },
  ];
}

function defaultApprovalOptions(nodeId: string): PlaygroundApprovalOption[] {
  if (nodeId === "planner") {
    return [
      { label: "继续澄清", value: "continue-planning" },
      { label: "我需要调整方向", value: "revise-plan" },
      { label: "终止当前方向", value: "reject-plan" },
    ];
  }

  return [
    { label: "继续执行", value: "continue-execution" },
    { label: "需要修改", value: "revise-result" },
    { label: "拒绝结果", value: "reject-result" },
  ];
}

function resolveApprovalQuestion(task: PlaygroundTask) {
  const payload = task.pendingApproval?.payload as { question?: string } | undefined;
  return (
    payload?.question ??
    task.inputPayload.clarification?.question ??
    task.pendingApproval?.reason ??
    "请确认下一步方向。"
  );
}

export function filterTimeline(events: PlaygroundTraceEvent[], filter: TimelineFilter) {
  if (filter === "all") return events;
  if (filter === "approval") {
    return events.filter((event) => event.eventType.includes("approval") || event.nodeId === "planner");
  }
  if (filter === "planning") {
    return events.filter((event) => event.nodeId === "planner" || event.eventType.startsWith("plan.step_"));
  }
  if (filter === "execution") {
    return events.filter((event) => event.nodeId === "executor");
  }
  if (filter === "review") {
    return events.filter((event) => event.nodeId === "reviewer" || event.nodeId === "finalizer");
  }
  return events.filter((event) => Boolean(event.error));
}

export function timelineBadge(event: PlaygroundTraceEvent) {
  if (event.error) return "异常";
  if (event.eventType === "planner.re_evaluated") return "重评估";
  if (event.eventType === "planner.replanned") return "重规划";
  if (event.eventType.startsWith("plan.step_")) return "计划";
  if (event.eventType.includes("approval")) return "审批";
  if (event.nodeId === "planner") return "规划";
  if (event.nodeId === "executor") return "执行";
  if (event.nodeId === "reviewer" || event.nodeId === "finalizer") return "审校";
  return "事件";
}

export function formatStatus(status: PlaygroundTask["status"]) {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "运行中";
    case "awaiting_approval":
      return "等待审批";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
  }
}

export function formatNode(nodeId: string) {
  const mapping: Record<string, string> = {
    planner: "Planner",
    executor: "Executor",
    reviewer: "Reviewer",
    finalizer: "Finalizer",
    approval: "Approval",
  };
  return mapping[nodeId] ?? nodeId;
}

export function defaultInspectorFocus(session: PlaygroundSession | null, tab: InspectorTab = "intention"): InspectorFocus {
  if (!session) {
    return {
      type: "task",
      label: "等待会话创建",
      data: { message: "创建会话后，这里会展示结构化 JSON。" },
    };
  }

  if (tab === "memory") {
    return { type: "task", label: "Session Memory", data: session.sessionMemory };
  }

  const task = session.task;
  if (!task) {
    return { type: "task", label: "等待任务创建", data: {} };
  }

  if (tab === "structure") {
    return { type: "task", label: "Structure Draft", data: task.inputPayload.structureDraft ?? null };
  }
  if (tab === "output") {
    return { type: "result", label: "Final Output", data: task.result?.output ?? null };
  }
  return { type: "task", label: "Intention", data: task.inputPayload.intention ?? null };
}

export function relativeTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return timestamp;
  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function buildInspectorData(session: PlaygroundSession | null, tab: InspectorTab) {
  if (!session) {
    return null;
  }
  if (tab === "memory") {
    return session.sessionMemory;
  }
  if (!session.task) {
    return null;
  }
  if (tab === "intention") {
    return session.task.inputPayload.intention ?? null;
  }
  if (tab === "structure") {
    return session.task.inputPayload.structureDraft ?? null;
  }
  return session.task.result?.output ?? null;
}

export function buildWorkbenchState(
  session: PlaygroundSession | null,
  inspectorTab: InspectorTab,
  timelineFilter: TimelineFilter,
  inspectorFocus: InspectorFocus,
) {
  const task = session?.task ?? null;

  return {
    planItems: buildPlanList(session),
    approvalConfig: task ? buildApprovalOptions(task) : null,
    timeline: filterTimeline(task?.trace ?? [], timelineFilter),
    nextInspectorFocus:
      inspectorFocus.type === "task" &&
      ["等待会话创建", "等待任务创建", "Intention", "Structure Draft", "Final Output", "Session Memory"].includes(
        inspectorFocus.label,
      )
        ? defaultInspectorFocus(session, inspectorTab)
        : inspectorFocus,
  };
}
