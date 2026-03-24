import type { AgentRuntimeService, SessionMemoryState } from "@agent-foundry/core";
import type { ApprovalAction, Task } from "@agent-foundry/shared";

type SessionChatMessage = {
  id: string;
  taskId: string | null;
  kind: "user" | "assistant" | "error";
  body: string;
  createdAt: string;
};

type SessionMemoryView = SessionMemoryState;

export type SessionSnapshot = {
  sessionId: string;
  packageId: string;
  task: Task | null;
  historyMessages: SessionChatMessage[];
  sessionMemory: SessionMemoryView;
  createdAt: string;
  updatedAt: string;
};

type SessionRecord = {
  sessionId: string;
  packageId: string;
  taskId: string | null;
  latestTask: Task | null;
  historyMessages: SessionChatMessage[];
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  sessionMemory: SessionMemoryView;
  createdAt: string;
  updatedAt: string;
  seenMarkers: Set<string>;
  unsubscribeTask?: (() => void) | null;
};

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyMemory(sessionId: string): SessionMemoryView {
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

function toSnapshot(session: SessionRecord): SessionSnapshot {
  return {
    sessionId: session.sessionId,
    packageId: session.packageId,
    task: session.latestTask,
    historyMessages: session.historyMessages,
    sessionMemory: session.sessionMemory,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

/**
 * SessionOrchestrator is the bridge between chat-style UI sessions and the
 * underlying LangGraph task runtime. It keeps session history, translates
 * runtime task progress into session snapshots, and reads session-scoped
 * memory from the core runtime instead of owning that memory locally.
 */
export class SessionOrchestrator {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly listeners = new Map<string, Set<(snapshot: SessionSnapshot) => void>>();

  constructor(private readonly runtime: AgentRuntimeService) {}

  createSession(packageId = "perfume-formulation"): SessionSnapshot {
    const createdAt = now();
    const sessionId = id("session");
    const session: SessionRecord = {
      sessionId,
      packageId,
      taskId: null,
      latestTask: null,
      historyMessages: [],
      conversationHistory: [],
      sessionMemory: createEmptyMemory(sessionId),
      createdAt,
      updatedAt: createdAt,
      seenMarkers: new Set<string>(),
      unsubscribeTask: null,
    };
    this.sessions.set(session.sessionId, session);
    return toSnapshot(session);
  }

  getSession(sessionId: string): SessionSnapshot | null {
    const session = this.sessions.get(sessionId);
    return session ? toSnapshot(session) : null;
  }

  getSessionMemory(sessionId: string) {
    this.requireSession(sessionId);
    return this.runtime.getSessionMemory(sessionId);
  }

  async submitMessage(sessionId: string, content: string, modelId?: string): Promise<SessionSnapshot> {
    const session = this.requireSession(sessionId);
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("Message content is required.");
    }

    session.historyMessages.push({
      id: id("msg"),
      taskId: null,
      kind: "user",
      body: trimmed,
      createdAt: now(),
    });
    session.conversationHistory.push({
      role: "user",
      content: trimmed,
    });
    session.updatedAt = now();
    this.emit(session);

    const sessionMemory = await this.runtime.getSessionMemory(sessionId);
    const createdTask = await this.runtime.createTask(
      session.packageId,
      {
        goal: trimmed,
        conversation: session.conversationHistory,
        intention: sessionMemory.artifacts.intention,
        structureDraft: sessionMemory.artifacts.structureDraft,
      },
      modelId,
      sessionId,
    );

    await this.bindTask(session, createdTask.taskId);
    session.latestTask = createdTask;
    session.taskId = createdTask.taskId;
    session.updatedAt = now();
    await this.refreshSessionMemory(session);
    this.emit(session);

    return toSnapshot(session);
  }

  async submitApproval(
    sessionId: string,
    action: ApprovalAction,
    operator: string,
    payload?: unknown,
  ): Promise<SessionSnapshot> {
    const session = this.requireSession(sessionId);
    if (!session.taskId) {
      throw new Error("Session does not have an active task.");
    }

    const task = await this.runtime.submitApproval(session.taskId, action, operator, payload);
    await this.bindTask(session, task.taskId);
    session.latestTask = task;
    session.updatedAt = now();
    await this.refreshSessionMemory(session);
    this.emit(session);
    return toSnapshot(session);
  }

  async subscribeSession(
    sessionId: string,
    listener: (snapshot: SessionSnapshot) => void,
  ): Promise<() => void> {
    const session = this.requireSession(sessionId);
    const current = this.listeners.get(sessionId) ?? new Set<(snapshot: SessionSnapshot) => void>();
    current.add(listener);
    this.listeners.set(sessionId, current);
    listener(toSnapshot(session));

    return () => {
      const next = this.listeners.get(sessionId);
      if (!next) {
        return;
      }
      next.delete(listener);
      if (next.size === 0) {
        this.listeners.delete(sessionId);
      }
    };
  }

  private async bindTask(session: SessionRecord, taskId: string) {
    if (session.unsubscribeTask) {
      session.unsubscribeTask();
    }

    session.unsubscribeTask = await this.runtime.subscribeTask(taskId, (task) => {
      void (async () => {
        session.latestTask = task;
        session.taskId = task.taskId;
        session.updatedAt = now();
        await this.refreshSessionMemory(session);
        this.materializeTaskMessage(session, task);
        this.emit(session);
      })();
    });
  }

  private async refreshSessionMemory(session: SessionRecord) {
    session.sessionMemory = await this.runtime.getSessionMemory(session.sessionId);
  }

  private materializeTaskMessage(session: SessionRecord, task: Task) {
    if (task.status === "completed" && task.result) {
      const marker = `result:${task.taskId}`;
      if (session.seenMarkers.has(marker)) {
        return;
      }
      session.seenMarkers.add(marker);
      const body = task.result.summary || "本轮任务已完成。";
      session.historyMessages.push({
        id: id("msg"),
        taskId: task.taskId,
        kind: "assistant",
        body,
        createdAt: task.updatedAt,
      });
      session.conversationHistory.push({
        role: "assistant",
        content: body,
      });
      return;
    }

    if (task.status === "failed") {
      const marker = `error:${task.taskId}`;
      if (session.seenMarkers.has(marker)) {
        return;
      }
      session.seenMarkers.add(marker);
      const latestFailure = [...task.trace].reverse().find((entry) => entry.error);
      const body = latestFailure?.error ?? "当前任务执行失败。";
      session.historyMessages.push({
        id: id("msg"),
        taskId: task.taskId,
        kind: "error",
        body,
        createdAt: task.updatedAt,
      });
    }
  }

  private emit(session: SessionRecord) {
    const listeners = this.listeners.get(session.sessionId);
    if (!listeners) {
      return;
    }
    const snapshot = toSnapshot(session);
    listeners.forEach((listener) => listener(snapshot));
  }

  private requireSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }
}
