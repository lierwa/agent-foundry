import type {
  InspectorFocus,
  PlanProgressViewModel,
  PlaygroundMessage,
  PlaygroundPlanStep,
  PlaygroundTask,
  TimelineFilter,
  PlaygroundTraceEvent,
} from "./playground-types";

type ApprovalOption = {
  label: string;
  value: string;
};

export function createDefaultBrief() {
  return {
    goal: "我想做一款适合春季上新的木质调香水，前段不要太刺激，但需要结构成立。",
  };
}

export function toTaskInput(draft: { goal: string }) {
  return {
    goal: draft.goal,
    conversation: [
      {
        role: "user" as const,
        content: draft.goal,
      },
    ],
  };
}

export function buildMessages(task: PlaygroundTask | null): PlaygroundMessage[] {
  if (!task) {
    return [
      {
        id: "welcome",
        kind: "assistant",
        title: "开始新会话",
        body: "输入 brief 后开始任务。需要澄清时，Agent 会直接在消息流里向你提问。",
      },
    ];
  }

  const messages: PlaygroundMessage[] = [];
  const goal =
    typeof task.inputPayload.goal === "string"
      ? task.inputPayload.goal
      : "已创建新的 perfume 任务。";

  messages.push({
    id: `${task.taskId}-brief`,
    kind: "user",
    title: "用户 brief",
    body: goal,
    payload: task.inputPayload,
  });

  messages.push({
    id: `${task.taskId}-status`,
    kind: "system",
    title: "运行时状态",
    body: describeTaskStatus(task),
  });

  if (task.plan.length > 0) {
    messages.push({
      id: `${task.taskId}-plan`,
      kind: "plan",
      title: "当前计划",
      body: `共 ${task.plan.length} 个步骤，当前节点 ${formatNode(task.currentNode)}。本次重规划：${task.inputPayload.lastPlanningDecision?.replanMode ?? "none"}。`,
      payload: task.plan,
    });
  }

  if (task.inputPayload.intention) {
    messages.push({
      id: `${task.taskId}-intention`,
      kind: "intention",
      title: "当前 intention 草案",
      body: describeIntention(task),
      payload: task.inputPayload.intention,
    });
  }

  if (task.inputPayload.clarification) {
    messages.push({
      id: `${task.taskId}-clarification`,
      kind: "clarification",
      title: "Planner 当前缺口",
      body: task.inputPayload.clarification.question,
      payload: task.inputPayload.clarification,
    });
  }

  if (task.inputPayload.lastPlanningDecision) {
    messages.push({
      id: `${task.taskId}-planning-decision`,
      kind: "system",
      title: "Planner 决策",
      body: `replanMode=${task.inputPayload.lastPlanningDecision.replanMode}；${task.inputPayload.lastPlanningDecision.reason}`,
      payload: task.inputPayload.lastPlanningDecision,
    });
  }

  const milestones = task.trace.filter((event) =>
    /planner\.completed|executor\.completed|reviewer\.completed|finalizer\.completed|approval\.submitted|plan\.updated|candidate_pool\.updated|structure\.composed|intention\.updated/.test(
      event.eventType,
    ),
  );

  for (const event of milestones) {
    messages.push({
      id: event.id,
      kind: event.eventType === "approval.submitted" ? "system" : "assistant",
      title: event.nodeId,
      body: describeTraceEvent(event),
      payload: event,
    });
  }

  if (task.pendingApproval) {
    messages.push({
      id: task.pendingApproval.id,
      kind: "approval",
      title: "需要人工确认",
      body: task.pendingApproval.reason,
      payload: task.pendingApproval,
    });
  }

  if (task.result) {
    messages.push({
      id: `${task.taskId}-result`,
      kind: "result",
      title: "结果输出",
      body: task.result.summary || "任务已经完成，可以查看结构化结果与证据。",
      payload: task.result,
    });
  }

  return messages;
}

export function buildPlanProgress(task: PlaygroundTask | null): PlanProgressViewModel {
  if (!task) {
    return {
      total: 0,
      done: 0,
      activeStepId: null,
      activeStepTitle: null,
      statusLabel: "等待创建任务",
      replanMode: null,
      replanReason: null,
    };
  }

  const done = task.plan.filter((step) => step.status === "done").length;
  const activeStep =
    task.plan.find((step) => step.status === "ready") ??
    task.plan.find((step) => step.status === "pending") ??
    task.plan[task.plan.length - 1] ??
    null;

  return {
    total: task.plan.length,
    done,
    activeStepId: activeStep?.id ?? null,
    activeStepTitle: activeStep?.title ?? null,
    statusLabel: formatStatus(task.status),
    replanMode: task.inputPayload.lastPlanningDecision?.replanMode ?? null,
    replanReason: task.inputPayload.lastPlanningDecision?.reason ?? null,
  };
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
  if (event.eventType.startsWith("plan.step_")) return "计划Patch";
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

export function formatStepStatus(status: PlaygroundPlanStep["status"]) {
  switch (status) {
    case "done":
      return "已完成";
    case "ready":
      return "待执行";
    case "pending":
      return "未开始";
    case "blocked":
      return "阻塞";
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

export function describeTaskStatus(task: PlaygroundTask) {
  const goal = typeof task.inputPayload.goal === "string" ? task.inputPayload.goal : "未提供目标";
  return `任务当前处于「${formatStatus(task.status)}」，运行节点为 ${formatNode(task.currentNode)}。当前 brief：${goal}`;
}

function describeIntention(task: PlaygroundTask) {
  const intention = task.inputPayload.intention;
  if (!intention) {
    return "尚未生成 intention。";
  }

  return [
    `core_theme：${intention.core_theme ?? "待澄清"}`,
    `dominant_layer：${intention.dominant_layer ?? "待澄清"}`,
    `expressive_pool：${intention.expressive_pool.join("、") || "待补充"}`,
    `avoid_notes：${intention.avoid_notes.join("、") || "无"}`,
    `confidence：${intention.confidence_level}`,
  ].join(" | ");
}

export function describeTraceEvent(event: PlaygroundTraceEvent) {
  if (event.eventType === "approval.submitted") {
    return `操作人员已提交审批响应，当前节点 ${formatNode(event.nodeId)}。`;
  }

  const latency = typeof event.latencyMs === "number" ? `，耗时 ${event.latencyMs} ms` : "";
  return `${formatNode(event.nodeId)} 完成事件 ${event.eventType}${latency}。`;
}

export function buildApprovalOptions(task: PlaygroundTask) {
  const payload = task.pendingApproval?.payload as
    | {
        options?: Array<string | { label?: string; value?: string }>;
        multiple?: boolean;
        question?: string;
        decisionKey?: string;
      }
    | undefined;

  if (payload?.options?.length) {
    return {
      multiple: Boolean(payload.multiple),
      options: payload.options.map((item, index) =>
        typeof item === "string"
          ? { label: item, value: item }
          : {
              label: item.label ?? item.value ?? `选项 ${index + 1}`,
              value: item.value ?? item.label ?? `option-${index + 1}`,
            },
      ),
    };
  }

  if (task.pendingApproval?.nodeId === "planner") {
    return {
      multiple: false,
      options: [
        { label: "继续澄清", value: "continue-planning" },
        { label: "我需要调整方向", value: "revise-plan" },
        { label: "终止当前方向", value: "reject-plan" },
      ] satisfies ApprovalOption[],
    };
  }

  return {
    multiple: false,
    options: [
      { label: "继续执行", value: "continue-execution" },
      { label: "需要修改", value: "revise-result" },
      { label: "拒绝结果", value: "reject-result" },
    ] satisfies ApprovalOption[],
  };
}

export function defaultInspectorFocus(task: PlaygroundTask | null): InspectorFocus {
  if (!task) {
    return {
      type: "task",
      label: "等待任务创建",
      data: { message: "创建 perfume 任务后，这里会展示 intention、候选池与结构详情。" },
    };
  }

  return {
    type: "task",
      label: "Task State",
      data: task,
  };
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
