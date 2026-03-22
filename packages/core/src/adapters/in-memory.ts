import type { Task } from "@agent-foundry/shared";
import type { MemoryRecord, MemoryStore, TaskStore } from "../runtime/types.js";

export class InMemoryTaskStore implements TaskStore {
  private readonly tasks = new Map<string, Task>();

  async create(task: Task): Promise<void> {
    this.tasks.set(task.taskId, task);
  }

  async update(task: Task): Promise<void> {
    this.tasks.set(task.taskId, task);
  }

  async get(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) ?? null;
  }

  async list(): Promise<Task[]> {
    return [...this.tasks.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export class InMemoryMemoryStore implements MemoryStore {
  private readonly records: MemoryRecord[] = [];

  async append(record: MemoryRecord): Promise<void> {
    this.records.push(record);
  }

  async listByTask(taskId: string): Promise<MemoryRecord[]> {
    return this.records.filter((record) => record.taskId === taskId);
  }
}
