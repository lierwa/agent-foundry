import type { AgentPackage } from "./types.js";
import { AgentRuntimeService } from "./service.js";
import { PackageRegistry } from "./registry.js";
import { InMemoryMemoryStore, InMemoryTaskStore } from "../adapters/in-memory.js";
import { PostgresTaskStore } from "../adapters/postgres.js";
import { RedisMemoryStore } from "../adapters/redis.js";

export type RuntimeStoreMode = "in-memory" | "durable";

export interface RuntimeBootstrapOptions {
  packages?: AgentPackage[];
  registry?: PackageRegistry;
  env?: Pick<NodeJS.ProcessEnv, "AGENT_FOUNDRY_STORE_MODE" | "DATABASE_URL" | "REDIS_URL">;
}

function readStoreMode(value: string | undefined): RuntimeStoreMode {
  if (!value || value === "in-memory") {
    return "in-memory";
  }

  if (value === "durable") {
    return "durable";
  }

  throw new Error(
    `Invalid AGENT_FOUNDRY_STORE_MODE value: ${value}. Expected "in-memory" or "durable".`,
  );
}

function requireEnv(name: "DATABASE_URL" | "REDIS_URL", value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required when AGENT_FOUNDRY_STORE_MODE=durable`);
  }
  return value;
}

export function createRuntimeServices(options: RuntimeBootstrapOptions = {}): AgentRuntimeService {
  const registry = options.registry ?? new PackageRegistry();
  for (const pkg of options.packages ?? []) {
    registry.register(pkg);
  }

  const env = options.env ?? process.env;
  const mode = readStoreMode(env.AGENT_FOUNDRY_STORE_MODE);

  if (mode === "durable") {
    const taskStore = new PostgresTaskStore({
      connectionString: requireEnv("DATABASE_URL", env.DATABASE_URL),
    });
    const memoryStore = new RedisMemoryStore({
      url: requireEnv("REDIS_URL", env.REDIS_URL),
    });
    return new AgentRuntimeService(registry, taskStore, memoryStore);
  }

  return new AgentRuntimeService(registry, new InMemoryTaskStore(), new InMemoryMemoryStore());
}
