import type { Task } from "@agent-foundry/shared";
import type { MemoryRecord, MemoryStore, SessionMemoryState, TaskStore } from "../runtime/types.js";

export class InMemoryTaskStore implements TaskStore {
  private readonly tasks = new Map<string, Task>();
  private readonly listeners = new Map<string, Set<(task: Task) => void>>();

  async create(task: Task): Promise<void> {
    this.tasks.set(task.taskId, task);
    this.emit(task);
  }

  async update(task: Task): Promise<void> {
    this.tasks.set(task.taskId, task);
    this.emit(task);
  }

  async get(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) ?? null;
  }

  async list(): Promise<Task[]> {
    return [...this.tasks.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async subscribe(taskId: string, listener: (task: Task) => void): Promise<() => void> {
    const current = this.listeners.get(taskId) ?? new Set<(task: Task) => void>();
    current.add(listener);
    this.listeners.set(taskId, current);

    return () => {
      const next = this.listeners.get(taskId);
      if (!next) {
        return;
      }
      next.delete(listener);
      if (next.size === 0) {
        this.listeners.delete(taskId);
      }
    };
  }

  private emit(task: Task) {
    const listeners = this.listeners.get(task.taskId);
    if (!listeners) {
      return;
    }

    listeners.forEach((listener) => listener(task));
  }
}

export class InMemoryMemoryStore implements MemoryStore {
  private readonly records: MemoryRecord[] = [];
  private readonly sessions = new Map<string, SessionMemoryState>();

  async append(record: MemoryRecord): Promise<void> {
    this.records.push(record);
  }

  async listByTask(taskId: string): Promise<MemoryRecord[]> {
    return this.records.filter((record) => record.taskId === taskId);
  }

  async getSession(sessionId: string): Promise<SessionMemoryState | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async putSession(sessionId: string, memory: SessionMemoryState): Promise<void> {
    this.sessions.set(sessionId, memory);
  }
}
