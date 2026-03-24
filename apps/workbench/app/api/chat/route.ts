import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

type SessionStateResponse = {
  sessionId: string;
  task: {
    taskId: string;
    status:
      | "queued"
      | "running"
      | "awaiting_approval"
      | "completed"
      | "failed";
    currentNode: string;
    updatedAt: string;
    plan: Array<{
      id: string;
      title: string;
      status: "pending" | "ready" | "done" | "blocked";
    }>;
    trace: Array<{
      id: string;
      eventType: string;
      nodeId: string;
      model?: string;
      error?: string;
    }>;
    pendingApproval: { id: string; reason: string } | null;
    result: { summary: string } | null;
  } | null;
  sessionMemory: unknown;
};

type SessionSnapshotResponse = SessionStateResponse & {
  historyMessages: Array<{
    id: string;
    kind: "user" | "assistant" | "error";
    body: string;
    createdAt: string;
  }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractMessageText(message: UIMessage): string {
  const partsText = message.parts
    ?.filter(
      (part): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("\n")
    .trim();

  if (partsText) {
    return partsText;
  }
  return "";
}

function activePlanTitle(task: NonNullable<SessionStateResponse["task"]>) {
  const active =
    task.plan.find((step) => step.status === "ready") ??
    task.plan.find((step) => step.status === "pending") ??
    null;

  return active?.title ?? null;
}

function describeNode(nodeId: string) {
  if (nodeId === "planner") return "Planner";
  if (nodeId === "executor") return "Executor";
  if (nodeId === "reviewer") return "Reviewer";
  if (nodeId === "finalizer") return "Finalizer";
  return nodeId;
}

function latestFailure(task: NonNullable<SessionStateResponse["task"]>) {
  return [...task.trace].reverse().find((event) => event.error) ?? null;
}

function buildInitialNarration(task: NonNullable<SessionStateResponse["task"]>) {
  const lines = ["我先理解你的 brief，并判断当前缺口。"];
  const stepTitle = activePlanTitle(task);

  if (task.currentNode === "planner") {
    lines.push(
      stepTitle
        ? `当前我正从「${stepTitle}」开始组织这轮规划。`
        : "当前我正在做初始规划判断。",
    );
  } else {
    lines.push(`当前已经进入 ${describeNode(task.currentNode)}。`);
  }

  if (task.plan.length > 0) {
    lines.push(`已生成 ${task.plan.length} 个规划步骤。`);
  }

  return lines;
}

function buildDeltaLines(
  current: NonNullable<SessionStateResponse["task"]>,
  previous: NonNullable<SessionStateResponse["task"]> | null,
) {
  const lines: string[] = [];

  if (!previous) {
    return buildInitialNarration(current);
  }

  if (previous.currentNode !== current.currentNode) {
    if (current.currentNode === "planner") {
      lines.push("我正在重新梳理 brief，并收敛当前规划。");
    } else if (current.currentNode === "executor") {
      lines.push("我已经进入执行阶段，开始生成候选与结构。");
    } else if (
      current.currentNode === "reviewer" ||
      current.currentNode === "finalizer"
    ) {
      lines.push("我正在检查这轮结果是否成立，并整理最终输出。");
    }
  }

  if (current.plan.length > previous.plan.length) {
    const stepTitle = activePlanTitle(current);
    lines.push(
      stepTitle
        ? `新的计划步骤已经生成，当前聚焦「${stepTitle}」。`
        : `新的计划步骤已经生成，目前共有 ${current.plan.length} 步。`,
    );
  }

  if (
    !previous.pendingApproval &&
    current.pendingApproval &&
    previous.status !== "awaiting_approval"
  ) {
    lines.push("我已经定位到一个关键缺口，现在需要你给我一个明确选择。");
  }

  if (
    previous.status !== current.status &&
    current.status === "completed" &&
    current.result?.summary
  ) {
    lines.push(`本轮已经完成：${current.result.summary}`);
  }

  if (previous.status !== current.status && current.status === "failed") {
    const failure = latestFailure(current);
    lines.push(
      failure?.error
        ? `当前任务失败：${failure.error}`
        : "当前任务执行失败。请查看右侧时间线。",
    );
  }

  return lines;
}

async function postSessionMessage(
  sessionId: string,
  content: string,
  modelId?: string,
) {
  const response = await fetch(`${apiBaseUrl}/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      content,
      modelId,
    }),
  });

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ message: "发送消息失败。" }));
    throw new Error(body.message || "发送消息失败。");
  }

  return (await response.json()) as SessionSnapshotResponse;
}

async function fetchSessionState(sessionId: string) {
  const response = await fetch(`${apiBaseUrl}/sessions/${sessionId}/state`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("未能获取会话状态。");
  }

  return (await response.json()) as SessionStateResponse;
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    messages?: UIMessage[];
    sessionId?: string;
    modelId?: string;
  };

  const sessionId = body.sessionId?.trim();
  const messages = body.messages ?? [];
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  const content = lastUserMessage ? extractMessageText(lastUserMessage) : "";

  if (!sessionId) {
    return Response.json({ message: "sessionId is required." }, { status: 400 });
  }

  if (!content) {
    return Response.json(
      { message: "The latest user message is required." },
      { status: 400 },
    );
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const assistantTextId = `assistant-${Date.now()}`;
      let previousTask: SessionStateResponse["task"] = null;

      writer.write({ type: "start-step" });
      writer.write({ type: "text-start", id: assistantTextId });

      const writeLines = (lines: string[]) => {
        for (const line of lines) {
          writer.write({
            type: "text-delta",
            id: assistantTextId,
            delta: `• ${line}\n\n`,
          });
        }
      };

      const snapshot = await postSessionMessage(sessionId, content, body.modelId);

      if (snapshot.task) {
        writeLines(buildInitialNarration(snapshot.task));
        previousTask = snapshot.task;
      } else {
        writeLines(["会话已接收输入，但任务尚未创建完成。"]);
      }

      for (let attempt = 0; attempt < 180; attempt += 1) {
        const current = await fetchSessionState(sessionId);
        const task = current.task;

        if (!task) {
          await sleep(1000);
          continue;
        }

        const deltaLines = buildDeltaLines(task, previousTask);
        if (deltaLines.length > 0) {
          writer.write({ type: "start-step" });
          writeLines(deltaLines);
        }

        previousTask = task;

        if (
          task.status === "awaiting_approval" ||
          task.status === "completed" ||
          task.status === "failed"
        ) {
          break;
        }

        await sleep(1200);
      }

      writer.write({ type: "text-end", id: assistantTextId });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
