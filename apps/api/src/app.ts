import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { createRuntimeServices, type AgentRuntimeService } from "@agent-foundry/core";
import { perfumeAgentPackage } from "../../../packages/agents/perfume/src/index.js";
import { loadLocalEnv } from "./load-env.js";
import { modelCatalog } from "./model-catalog.js";
import { SessionOrchestrator } from "./session-orchestrator.js";
import { registerSessionRoutes } from "./routes/session-routes.js";
import { registerSystemRoutes } from "./routes/system-routes.js";
import { registerTaskRoutes } from "./routes/task-routes.js";

const loadedEnvPath = loadLocalEnv();

export interface BuildAppOptions {
  runtime?: AgentRuntimeService;
  logger?: boolean | FastifyBaseLogger;
}

// API 组装层：注入 runtime、会话编排器与 routes，不承载业务流程逻辑。
export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const runtime =
    options.runtime ??
    createRuntimeServices({
      packages: [perfumeAgentPackage],
      modelCatalog,
    });
  const sessions = new SessionOrchestrator(runtime);

  const app = Fastify({
    logger: options.logger ?? false,
  });

  void app.register(cors, {
    origin: true,
  });

  registerSystemRoutes(app, {
    runtime,
    loadedEnvPath,
  });
  registerTaskRoutes(app, {
    runtime,
  });
  registerSessionRoutes(app, {
    sessions,
  });

  return app;
}
