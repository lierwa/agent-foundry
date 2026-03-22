import { createClient, type RedisClientType } from "redis";
import { z } from "zod";
import type { MemoryRecord, MemoryStore, StoredMemoryRecord } from "../runtime/types.js";

const memoryRecordSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  channel: z.enum(["structured", "semantic"]),
  summary: z.string(),
  payload: z.unknown(),
  createdAt: z.string(),
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

  private key(taskId: string): string {
    return `agent-foundry:memory:${taskId}`;
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
