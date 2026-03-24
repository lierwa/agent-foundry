import type { ModelProviderConfig } from "@agent-foundry/core";

export const modelCatalog: ModelProviderConfig[] = [
  {
    provider: "doubao",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    apiKeyEnv: "DOUBAO_API_KEY",
    models: [
      {
        id: "doubao-seed-2-0-lite-260215",
        label: "doubao-seed-2-0-lite-260215",
        model: "doubao-seed-2-0-lite-260215",
      },
      {
        id: "doubao-seed-2-0-pro-260215",
        label: "doubao-seed-2-0-pro-260215",
        model: "doubao-seed-2-0-pro-260215",
      }
    ],
  },
  {
    provider: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKeyEnv: "QWEN_API_KEY",
    models: [
      {
        id: "qwen-max",
        label: "qwen-max",
        model: "qwen-max",
      },
      {
        id: "deepseek-r1-distill-qwen-32b",
        label: "deepseek-r1-distill-qwen-32b",
        model: "deepseek-r1-distill-qwen-32b",
      },
    ],
  },
];
