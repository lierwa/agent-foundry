import type { TaskModelConfig } from "@agent-foundry/shared";
import type { ZodTypeAny } from "zod";
import type { ChatModelMessage } from "./types.js";

export type ModelCatalogEntry = TaskModelConfig & {
  baseUrl: string;
  apiKeyEnv: string;
  enabled?: boolean;
};

export type ModelProviderConfig = {
  provider: string;
  baseUrl: string;
  apiKeyEnv: string;
  enabled?: boolean;
  models: Array<{
    id: string;
    label: string;
    model: string;
    enabled?: boolean;
  }>;
};

export type PublicModelCatalogEntry = TaskModelConfig;

export class ModelRequestError extends Error {
  statusCode: number;
  provider: string;
  modelId: string;

  constructor(options: {
    message: string;
    statusCode?: number;
    provider: string;
    modelId: string;
  }) {
    super(options.message);
    this.name = "ModelRequestError";
    this.statusCode = options.statusCode ?? 502;
    this.provider = options.provider;
    this.modelId = options.modelId;
  }
}

export class ModelStructuredOutputError extends Error {
  provider: string;
  modelId: string;
  rawText: string;
  parseError: string;

  constructor(options: {
    message: string;
    provider: string;
    modelId: string;
    rawText: string;
    parseError: string;
  }) {
    super(options.message);
    this.name = "ModelStructuredOutputError";
    this.provider = options.provider;
    this.modelId = options.modelId;
    this.rawText = options.rawText;
    this.parseError = options.parseError;
  }
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeContent(content: string | Array<{ type?: string; text?: string }> | undefined) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => (typeof entry?.text === "string" ? entry.text : ""))
      .join("")
      .trim();
  }

  return "";
}

function extractJsonPayload(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Model returned an empty response.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) {
      throw new Error(`Model did not return valid JSON: ${trimmed.slice(0, 200)}`);
    }
    return JSON.parse(trimmed.slice(first, last + 1));
  }
}

function parseCatalog(rawCatalog: string | undefined): ModelCatalogEntry[] {
  if (!rawCatalog) {
    return [];
  }

  const parsed = JSON.parse(rawCatalog) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("AGENT_FOUNDRY_MODEL_CATALOG must be a JSON array.");
  }

  return parsed
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .filter((entry) => entry.enabled !== false)
    .map((entry) => ({
      id: String(entry.id),
      label: String(entry.label),
      provider: String(entry.provider),
      model: String(entry.model),
      baseUrl: trimTrailingSlash(String(entry.baseUrl)),
      apiKeyEnv: String(entry.apiKeyEnv),
      enabled: entry.enabled === undefined ? true : Boolean(entry.enabled),
    }));
}

export function expandModelCatalog(configs: ModelProviderConfig[]): ModelCatalogEntry[] {
  return configs.flatMap((providerConfig) => {
    if (providerConfig.enabled === false) {
      return [];
    }

    const baseUrl = trimTrailingSlash(providerConfig.baseUrl);

    return providerConfig.models
      .filter((modelConfig) => modelConfig.enabled !== false)
      .map((modelConfig) => ({
        id: modelConfig.id,
        label: modelConfig.label,
        provider: providerConfig.provider,
        model: modelConfig.model,
        baseUrl,
        apiKeyEnv: providerConfig.apiKeyEnv,
        enabled: modelConfig.enabled === undefined ? true : Boolean(modelConfig.enabled),
      }));
  });
}

export class ModelRegistry {
  private readonly entries: ModelCatalogEntry[];

  constructor(
    catalog: string | ModelCatalogEntry[] | ModelProviderConfig[] | undefined,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {
    this.entries = Array.isArray(catalog)
      ? catalog.length > 0 && "models" in catalog[0]
        ? expandModelCatalog(catalog as ModelProviderConfig[])
        : (catalog as ModelCatalogEntry[])
      : parseCatalog(catalog);
  }

  list(): PublicModelCatalogEntry[] {
    return this.entries
      .filter((entry) => Boolean(this.env[entry.apiKeyEnv]))
      .map(({ id, label, provider, model }) => ({ id, label, provider, model }));
  }

  get(modelId: string): PublicModelCatalogEntry | null {
    return this.list().find((entry) => entry.id === modelId) ?? null;
  }

  resolve(modelId: string): ModelCatalogEntry & { apiKey: string } {
    const entry = this.entries.find((item) => item.id === modelId);
    if (!entry) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const apiKey = this.env[entry.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`Model ${modelId} is not configured. Missing env ${entry.apiKeyEnv}.`);
    }

    return {
      ...entry,
      apiKey,
    };
  }
}

export class OpenAICompatibleModelService {
  constructor(
    private readonly registry: ModelRegistry,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generateObject(options: {
    modelId: string;
    schema: ZodTypeAny;
    messages: ChatModelMessage[];
    temperature?: number;
  }): Promise<{ object: unknown; rawText: string; model: PublicModelCatalogEntry }> {
    const resolved = this.registry.resolve(options.modelId);
    const response = await this.fetchImpl(`${resolved.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolved.apiKey}`,
      },
      body: JSON.stringify({
        model: resolved.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as ChatCompletionResponse;
    if (!response.ok) {
      throw new ModelRequestError({
        message: body.error?.message || `Model request failed with status ${response.status}.`,
        statusCode: response.status >= 500 ? 502 : 400,
        provider: resolved.provider,
        modelId: resolved.id,
      });
    }

    const rawText = normalizeContent(body.choices?.[0]?.message?.content);

    try {
      const object = options.schema.parse(extractJsonPayload(rawText));

      return {
        object,
        rawText,
        model: {
          id: resolved.id,
          label: resolved.label,
          provider: resolved.provider,
          model: resolved.model,
        },
      };
    } catch (error) {
      throw new ModelStructuredOutputError({
        message: error instanceof Error ? error.message : "Model returned invalid structured output.",
        provider: resolved.provider,
        modelId: resolved.id,
        rawText,
        parseError: error instanceof Error ? error.message : "Unknown structured output parse error.",
      });
    }
  }
}
