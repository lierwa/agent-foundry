import { Pool, type PoolConfig } from "pg";
import { taskSchema, type Task } from "@agent-foundry/shared";
import type { TaskStore } from "../runtime/types.js";

type TaskRow = {
  task_id: string;
  created_at: string;
  updated_at: string;
  task: unknown;
};

const TABLE_NAME = "agent_foundry_tasks";

export interface PostgresTaskStoreOptions {
  connectionString?: string;
  pool?: Pool;
  config?: PoolConfig;
}

export class PostgresTaskStore implements TaskStore {
  private readonly pool: Pool;
  private readonly ownsPool: boolean;
  private readonly ready: Promise<void>;

  constructor(options: PostgresTaskStoreOptions) {
    if (options.pool) {
      this.pool = options.pool;
      this.ownsPool = false;
    } else {
      this.pool = new Pool({
        connectionString: options.connectionString,
        ...options.config,
      });
      this.ownsPool = true;
    }

    this.ready = this.initialize();
  }

  async create(task: Task): Promise<void> {
    await this.ready;
    await this.pool.query(
      `INSERT INTO ${TABLE_NAME} (task_id, created_at, updated_at, task)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (task_id)
       DO UPDATE SET updated_at = EXCLUDED.updated_at, task = EXCLUDED.task`,
      [task.taskId, task.createdAt, task.updatedAt, task],
    );
  }

  async update(task: Task): Promise<void> {
    await this.create(task);
  }

  async get(taskId: string): Promise<Task | null> {
    await this.ready;
    const result = await this.pool.query<TaskRow>(
      `SELECT task_id, created_at, updated_at, task
       FROM ${TABLE_NAME}
       WHERE task_id = $1
       LIMIT 1`,
      [taskId],
    );
    const row = result.rows[0];
    return row ? taskSchema.parse(row.task) : null;
  }

  async list(): Promise<Task[]> {
    await this.ready;
    const result = await this.pool.query<TaskRow>(
      `SELECT task_id, created_at, updated_at, task
       FROM ${TABLE_NAME}
       ORDER BY created_at DESC`,
    );
    return result.rows.map((row: TaskRow) => taskSchema.parse(row.task));
  }

  private async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        task_id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        task JSONB NOT NULL
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS ${TABLE_NAME}_created_at_idx
      ON ${TABLE_NAME} (created_at DESC)
    `);
  }

  async close(): Promise<void> {
    if (this.ownsPool) {
      await this.pool.end();
    }
  }
}
