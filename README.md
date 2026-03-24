# Agent Foundry

一个面向受控 Chat Agent 的 TypeScript monorepo。当前仓库的核心形态已经变成：

- `packages/core` 只负责通用 runtime
- 具体 agent 以独立 package 接入
- workbench 以 chat 方式驱动任务，而不是固定表单 workflow

当前第一套完整参考实现是 `perfume agent`。

## 这是什么

这个项目不是聊天机器人 demo，而是一套可扩展的 Agent Runtime 基线，目标是让操作人员能够：

- 从 chat 输入自然语言 brief
- 让 agent 在运行中逐步生成 `intention`
- 动态更新 plan，而不是一次性静态拆完任务
- 在关键节点让人工确认方向
- 查看状态、trace、tool 调用、候选池与最终结果
- 在不改 runtime 主干的前提下继续接入新的 agent package

## 当前架构

### `packages/core`

通用 runtime 层，负责：

- package registry
- task 生命周期
- 动态 plan 更新
- approval / human-in-the-loop 协议
- tool 调用协议与 trace
- task / memory 持久化接口

`core` 不再承载 perfume 的领域逻辑。

### `packages/agents/perfume`

首个独立 agent package，包含：

- `manifest.ts`
- `schemas.ts`
- `planner.ts`
- `executor.ts`
- `reviewer.ts`
- `summarizer.ts`
- `prompts/`
- `prompt-builders.ts`
- `tools/`
- `knowledge/`

当前 perfume agent 的行为是：

- 用户只输入自然语言 brief
- planner 逐步生成 `intention`
- 必要时通过问题卡发起人工确认
- executor 从本地香材库与分类定义构建候选池
- 最终输出符合 `perfume-knowledge/recommend.md` 的六层 JSON 结构

### `apps/api`

Fastify API，对外提供：

- `GET /packages`
- `GET /models`
- `GET /tasks`
- `GET /tasks/:taskId`
- `POST /tasks`
- `POST /tasks/:taskId/approval`

当前仍复用 task/approval API，没有新增独立 message API。

### `apps/workbench`

Next.js 操作台。当前首页已经是三栏式中文 Agent Playground：

- 左侧：state / memory / intention / 候选池 / 结构草案
- 中间：chat 主线程、plan、clarification、结果
- 右侧：timeline / trace / tool 调用

当前 perfume 用例不再使用固定结构化参数表单，输入区只保留自然语言 brief。

### `packages/shared`

共享 schema 与类型，供 runtime、agent package、API、workbench 共用。

当前已包含：

- `PerfumeTaskInput`
- `PerfumeIntention`
- `ClarificationQuestion`
- `PerfumeMaterialCandidate(Set)`
- `PerfumeStructureOutput`

## Prompt 方案

当前 agent prompt 采用 `Hybrid`：

- 长规则文档放 `.md`
- 运行时上下文拼装放 `.ts`

以 perfume 为例：

- `prompts/planner.md`
- `prompts/executor.md`
- `prompts/reviewer.md`
- `prompt-builders.ts`

## Tool 方案

`core` 提供通用 `ToolDefinition` 协议；agent 自己声明专属 tools。

当前 perfume agent 已包含：

- `build_intention_from_conversation`
- `generate_clarification_question`
- `search_notes`
- `resolve_category_candidates`
- `build_candidate_pool`
- `compose_structure_layers`
- `validate_structure`

runtime 会把工具调用写入 trace，包括：

- `tool.called`
- `tool.completed`
- `tool.failed`

## 仓库结构

- `apps/api`
  Fastify HTTP API

- `apps/workbench`
  Next.js operator workbench

- `packages/core`
  通用 runtime、graph、registry、adapters

- `packages/agents/perfume`
  首个独立 perfume agent package

- `packages/shared`
  共享 schema 与类型

- `perfume-knowledge`
  perfume 领域知识，包括：
  - `recommend.md`
  - `notes_info_with_profile_enriched.json`
  - `definitions.ts`

- `infra`
  本地 Postgres / Redis / app 的 Docker 配置

- `.planning`
  GSD 规划、路线图、状态和 codebase 文档

## 运行模式

### in-memory

```bash
export AGENT_FOUNDRY_STORE_MODE=in-memory
```

### durable

```bash
export AGENT_FOUNDRY_STORE_MODE=durable
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/agent_foundry
export REDIS_URL=redis://localhost:6379
```

## 模型热插拔

runtime 现在支持通过统一的 OpenAI-compatible catalog 接入多家模型提供方。当前任务创建时可以选择模型，workbench 输入框会显示模型选择器；如果不选模型，则继续走现有规则模式。

模型目录已经改成仓库内固定配置，不放在 `.env`。

先复制一份本地配置：

```bash
cp apps/api/.env.example apps/api/.env
```

然后把 [apps/api/.env](/Users/junxi/Desktop/work/agent-foundry/apps/api/.env) 里的 API key 改成你自己的。

模型列表、`baseUrl`、`provider`、默认 `model` 在 [model-catalog.ts](/Users/junxi/Desktop/work/agent-foundry/apps/api/src/model-catalog.ts) 里维护。
同一家 provider 只需要写一次 `baseUrl` 和 `apiKeyEnv`，下面挂多个模型即可。

如果 workbench API 地址也要固定配置，可以额外创建：

```bash
cat > apps/workbench/.env <<'EOF'
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
EOF
```

说明：

- `id` 是前端选择框和任务持久化使用的稳定标识
- `label` 是 workbench 里展示的模型名
- `provider` 只是展示和 trace 标记
- `model` 和 `baseUrl` 在代码配置中维护，不属于环境变量
- 只有 `apiKeyEnv` 对应环境变量存在时，模型才会出现在 `GET /models` 和 workbench 选择框中
- API 启动时会自动读取 `apps/api/.env`

## 快速开始

### 1. 安装依赖

```bash
source ~/.zshrc
npm_config_cache=.npm-cache npm install
```

### 2. 环境检查

```bash
npm run doctor
```

### 3. 选择 store mode

```bash
export AGENT_FOUNDRY_STORE_MODE=in-memory
```

或：

```bash
export AGENT_FOUNDRY_STORE_MODE=durable
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/agent_foundry
export REDIS_URL=redis://localhost:6379
npm run docker:up
```

### 4. 启动 API

```bash
npm run dev:api
```

### 5. 启动 workbench

```bash
npm run dev:web
```

默认地址：

- API: `http://localhost:4000`
- Workbench: `http://localhost:3000`

## 验证命令

```bash
npm run typecheck
npm run test
```

当前自动化验证覆盖：

- `packages/core` runtime 生命周期
- `packages/agents/perfume` 独立 agent 行为
- `apps/api` Fastify route contract

## 如何新增一个 agent

目标是做到：新增 `wardrobe agent` 时，不需要改 runtime 主干。

推荐步骤：

1. 新建 `packages/agents/wardrobe/`
2. 实现同构目录：
   - `manifest.ts`
   - `schemas.ts`
   - `planner.ts`
   - `executor.ts`
   - `reviewer.ts`
   - `summarizer.ts`
   - `prompts/`
   - `prompt-builders.ts`
   - `tools/`
   - `knowledge/`
3. 在 API bootstrap 中注册这个 package
4. 复用 workbench 的通用 task/approval/chat 视图

## 当前状态

当前已经完成：

- runtime 持久化与验证基线
- workbench 三栏式 chat playground
- perfume agent 的 package 化、Hybrid prompt、tools/knowledge 分层、六层输出首版

下一步重点：

- 把 perfume agent 从启发式执行推进到真实模型驱动
- 收紧 `intention / clarification / output` 契约
- 用第二个 agent 验证 package 化扩展路径
