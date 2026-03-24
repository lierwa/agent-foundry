import { createClient, type RedisClientType } from "redis";
import { z } from "zod";
import type {
  MemoryRecord,
  MemoryStore,
  SessionMemoryState,
  StoredMemoryRecord,
} from "../runtime/types.js";

const memoryRecordSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  sessionId: z.string().nullable().optional(),
  channel: z.enum(["structured", "semantic"]),
  summary: z.string(),
  payload: z.unknown(),
  createdAt: z.string(),
});

const sessionMemorySchema = z.object({
  sessionId: z.string(),
  facts: z.object({
    core_theme: z.string().nullable(),
    expressive_pool: z.array(z.string()),
    dominant_layer: z.enum(["Body", "Structure"]).nullable(),
    impact_policy: z.enum(["forbidden", "limited", "allowed"]).nullable(),
    avoid_notes: z.array(z.string()),
  }),
  artifacts: z.object({
    intention: z.unknown().nullable(),
    structureDraft: z.unknown().nullable(),
    finalOutput: z.unknown().nullable(),
  }),
  history: z.array(
    z.object({
      taskId: z.string(),
      summary: z.string(),
      updatedAt: z.string(),
      status: z.enum(["queued", "running", "awaiting_approval", "completed", "failed"]),
    }),
  ),
  updatedAt: z.string(),
});

type RedisClient = RedisClientType;

export interface RedisMemoryStoreOptions {
  client?: RedisClient;
  url?: string;
}

export class RedisMemoryStore implements MemoryStore {
  private readonly client: RedisClient;
  private readonly ownsClient: boolean;
  private readonly ready: Promise<void>;

  constructor(options: RedisMemoryStoreOptions = {}) {
    if (options.client) {
      this.client = options.client;
      this.ownsClient = false;
    } else {
      this.client = createClient({ url: options.url });
      this.ownsClient = true;
    }

    this.ready = this.connect();
  }

  async append(record: MemoryRecord): Promise<void> {
    await this.ready;
    await this.client.rPush(this.key(record.taskId), JSON.stringify(record));
  }

  async listByTask(taskId: string): Promise<MemoryRecord[]> {
    await this.ready;
    const records = await this.client.lRange(this.key(taskId), 0, -1);
    return records.map((entry) => memoryRecordSchema.parse(JSON.parse(entry)) as StoredMemoryRecord);
  }

  async getSession(sessionId: string): Promise<SessionMemoryState | null> {
    await this.ready;
    const raw = await this.client.get(this.sessionKey(sessionId));
    return raw ? (sessionMemorySchema.parse(JSON.parse(raw)) as SessionMemoryState) : null;
  }

  async putSession(sessionId: string, memory: SessionMemoryState): Promise<void> {
    await this.ready;
    await this.client.set(this.sessionKey(sessionId), JSON.stringify(memory));
  }

  private key(taskId: string): string {
    return `agent-foundry:memory:${taskId}`;
  }

  private sessionKey(sessionId: string): string {
    return `agent-foundry:session-memory:${sessionId}`;
  }

  private async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async close(): Promise<void> {
    if (this.ownsClient && this.client.isOpen) {
      await this.client.quit();
    }
  }
}
