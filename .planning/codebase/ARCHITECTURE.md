# Architecture

**Analysis Date:** 2026-03-23

## Pattern Overview

**Overall:** Monorepo agent runtime platform with a generic runtime core, standalone agent packages, HTTP API, and chat-driven operator workbench.

**Key Characteristics:**
- 通用 runtime 与领域 agent 解耦
- Graph-driven task lifecycle
- Dynamic plan snapshots instead of fixed one-shot planning
- Human-in-the-loop approval used as clarification channel
- Tool protocol with traceable calls

## Layers

**Workbench Layer**
- Purpose: 通过 chat 创建任务、查看状态、回答 clarification、调试 trace
- Contains: `apps/workbench/app/*`

**API Layer**
- Purpose: 暴露 task / approval / package 查询接口
- Contains: `apps/api/src/app.ts`, `apps/api/src/index.ts`

**Runtime Core Layer**
- Purpose: 管理 task 生命周期、approval、plan 更新、tool trace、memory persistence
- Contains: `packages/core/src/runtime/*`, `packages/core/src/graph/*`, `packages/core/src/adapters/*`
- Does not contain: perfume / wardrobe 等领域逻辑

**Agent Package Layer**
- Purpose: 封装某个领域 agent 的 prompts、tools、knowledge、planner、executor、reviewer
- Current example: `packages/agents/perfume`

**Shared Contract Layer**
- Purpose: 维护跨 runtime / API / UI / agent package 的共享 schema
- Contains: `packages/shared/src/index.ts`

**Knowledge Layer**
- Purpose: 承载领域知识源与定义文件
- Current example: `perfume-knowledge/`

## Data Flow

1. Operator 在 workbench 输入自然语言 brief
2. Workbench POST `/tasks`
3. API 调 `AgentRuntimeService.createTask`
4. Runtime 根据 `packageId` 解析到独立 agent package
5. Planner 生成或更新 `intention`、`plan`，必要时发起 clarification approval
6. Operator 回答 clarification，API POST `/tasks/:taskId/approval`
7. Runtime 重新进入 planner 或继续 executor
8. Executor 调用 agent tools，构建候选池与输出草案
9. Reviewer 校验输出
10. Finalizer 写入 summary，runtime 持久化 memory refs

## Key Abstractions

**AgentPackage**
- 通用 agent 接入协议
- 声明 schema、tools、approval policy、planner/executor/reviewer/summarizer

**ToolDefinition**
- 通用工具协议
- 由 runtime 统一记录 `tool.called / tool.completed / tool.failed`

**PackageRegistry**
- 注册并解析可用 agent packages

**AgentRuntimeService**
- 协调 planning、approval、execution、review、finalization、persistence

**Perfume Agent**
- 首个独立 agent package
- 使用 Hybrid prompt、knowledge loaders、本地 tools、动态 plan 和六层输出

---

*Architecture analysis: 2026-03-23*
