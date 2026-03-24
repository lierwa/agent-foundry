import type { FastifyInstance } from "fastify";
import type { AgentRuntimeService } from "@agent-foundry/core";

export function registerSystemRoutes(
  app: FastifyInstance,
  options: {
    runtime: AgentRuntimeService;
    loadedEnvPath: string | null;
  },
) {
  app.get("/health", async () => ({
    ok: true,
  }));

  app.get("/packages", async () => {
    return options.runtime.listPackages().map((pkg) => ({
      id: pkg.id,
      version: pkg.version,
      title: pkg.title,
      description: pkg.description,
      approvalPolicy: pkg.approvalPolicy,
    }));
  });

  app.get("/models", async () => {
    const items = options.runtime.listModels();
    return {
      items,
      meta: {
        count: items.length,
        loadedEnvPath: options.loadedEnvPath,
      },
    };
  });
}
