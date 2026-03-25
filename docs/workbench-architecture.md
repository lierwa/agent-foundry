# Workbench 架构全景（UI → API → Runtime → Store）

## 0. 一句话总览

当前仓库采用 **session-first UI + task-first runtime** 的双层模型：

- 前端围绕 `Session` 交互（聊天、审批、状态面板）。
- 后端 `SessionOrchestrator` 负责把会话语义转换为 runtime 的 `Task` 生命周期。
- 核心运行时 `AgentRuntimeService` 使用 LangGraph 执行 planner/executor/reviewer/finalizer。
- 状态持久化分为任务存储（TaskStore）与记忆存储（MemoryStore），可切 in-memory/durable。

---

## 1. 分层与责任边界

### 1.1 UI 层（Next.js Workbench）

关键文件：

- `apps/workbench/app/page.tsx`
- `apps/workbench/app/playground.tsx`
- `apps/workbench/app/use-agent-session.ts`
- `apps/workbench/app/assistant-chat-surface.tsx`
- `apps/workbench/app/api/chat/route.ts`
- `apps/workbench/app/playground-adapter.ts`
- `apps/workbench/app/session-client.ts`

职责：

- `page.tsx`：注入 API base URL，挂载 Playground。
- `playground.tsx`：三栏布局编排（Inspector / Chat / Timeline），不持有网络副作用。
- `use-agent-session.ts`：会话状态机、SSE 订阅、轮询兜底、审批草稿状态、模型列表管理。
- `assistant-chat-surface.tsx`：接入 `@assistant-ui/react-ai-sdk`，向 `/api/chat` 发送聊天消息并接收流式文本。
- `api/chat/route.ts`：前端 BFF 路由，把 AI SDK 消息协议转发成 session API 调用。
- `playground-adapter.ts`：把后端 Task/Snapshot 转成 UI ViewModel（plan/timeline/approval/inspector）。
- `session-client.ts`：非聊天接口 HTTP 封装（create/fetch session、approval、models）。

### 1.2 API 层（Fastify）

关键文件：

- `apps/api/src/index.ts`
- `apps/api/src/app.ts`
- `apps/api/src/routes/system-routes.ts`
- `apps/api/src/routes/task-routes.ts`
- `apps/api/src/routes/session-routes.ts`
- `apps/api/src/routes/sse.ts`
- `apps/api/src/session-orchestrator.ts`

职责：

- `index.ts`：进程入口，监听端口。
- `app.ts`：组装 runtime 与 route（依赖注入中心）。
- `system-routes.ts`：health/packages/models 查询。
- `task-routes.ts`：保留 task 兼容 API。
- `session-routes.ts`：session-first API（创建会话、发消息、审批、拉流）。
- `sse.ts`：SSE 统一实现（header、heartbeat、连接关闭清理）。
- `session-orchestrator.ts`：会话与任务的桥接器，维护 session snapshot。

### 1.3 Runtime 层（core）

关键文件：

- `packages/core/src/runtime/bootstrap.ts`
- `packages/core/src/runtime/service.ts`
- `packages/core/src/runtime/types.ts`
- `packages/core/src/graph/planning.ts`
- `packages/core/src/graph/execution.ts`
- `packages/core/src/adapters/in-memory.ts`
- `packages/core/src/adapters/postgres.ts`
- `packages/core/src/adapters/redis.ts`

职责：

- `bootstrap.ts`：根据环境选择 in-memory/durable store，初始化 model registry/service。
- `service.ts`：核心编排与状态机（创建任务、审批、图执行、trace、记忆同步与持久化）。
- `types.ts`：AgentPackage / PackageRunContext / Store 接口 / RuntimeState 契约。
- `planning.ts`：planning graph（单节点 planner）。
- `execution.ts`：execution graph（executor → reviewer → finalizer，含审批分支）。
- `adapters/*`：任务与记忆的具体存储实现。

---

## 2. 端到端调用链（最重要）

### 2.1 首次进入页面

1. `page.tsx` 渲染 `AgentPlayground`。
2. `playground.tsx` 调用 `useAgentSession(apiBaseUrl)`。
3. `useAgentSession` 内部 `ensureSession()` 首次触发 `POST /sessions`。
4. API `session-routes.ts` 调用 `SessionOrchestrator.createSession()` 返回空快照。

### 2.2 用户发送一条聊天消息

1. 用户在 `assistant-chat-surface.tsx` 输入。
2. `AssistantChatTransport` 发起 `POST /api/chat`（Next route）。
3. `apps/workbench/app/api/chat/route.ts` 解析 `messages/sessionId/modelId`。
4. route 调 `POST /sessions/:sessionId/messages`。
5. `SessionOrchestrator.submitMessage()`：
   - 先写 user message 到 session history；
   - 读取 runtime session memory；
   - 调 `runtime.createTask(packageId, input, modelId, sessionId)`。
6. runtime 创建 task 后后台执行 planning/execution。
7. route 轮询 `GET /sessions/:sessionId/state`，把任务进展转成 UI 文本流返回给聊天窗口。

### 2.3 SSE 实时状态更新（与聊天流并行）

1. `use-agent-session.ts` 在任务运行中打开 `EventSource(/sessions/:sessionId/stream)`。
2. `openSse()` 推送 `session.snapshot` 事件。
3. UI 收到 snapshot 后更新：
   - plan strip
   - timeline
   - inspector JSON
   - approval 卡片

### 2.4 审批链路

1. UI 提交 `POST /sessions/:sessionId/approval`。
2. `SessionOrchestrator.submitApproval()` 转调 `runtime.submitApproval(taskId, action, operator, payload)`。
3. runtime 清理 pendingApproval，按节点恢复：
   - planner 审批后回 planning
   - executor 审批后回 execution
   - reject 直接失败

---

## 3. UI 内部状态模型

`use-agent-session.ts` 管理三类状态：

- 会话域状态：`session/sessionId/task/models/selectedModelId`
- 交互状态：`approvalDraft/message/isPending`
- 展示状态：`timelineFilter/inspectorTab/inspectorFocus`

关键机制：

- **SSE 优先，轮询兜底**：SSE 出错后自动切换 5s 轮询。
- **审批草稿绑定 approvalId**：防止任务切换时旧草稿污染。
- **adapter 层转换**：`buildWorkbenchState` 将后端原始结构压扁为 UI 可渲染状态。

---

## 4. SessionOrchestrator 语义

`SessionOrchestrator` 的本质是“会话投影层”：

- Session 是 UI 交互容器，不替代 runtime Task。
- 每次 user message 都会创建新 task（携带 conversation + memory）。
- 通过 `bindTask()` 订阅任务更新并投影为 session snapshot。
- 通过 `materializeTaskMessage()` 把 completed/failed 任务映射成 assistant/error chat message。

它维护的数据：

- `historyMessages`：给 UI 中心聊天线程看。
- `conversationHistory`：给下一轮 planner 提供上下文。
- `sessionMemory`：从 runtime 拉取并投影，不本地做“真源”。

---

## 5. Runtime 任务状态机

`AgentRuntimeService` 核心入口：

- `createTask()`：校验输入、落库、启动 planning。
- `submitApproval()`：记录审批事件并恢复相应阶段。
- `subscribeTask()`：提供 task 级订阅能力。

阶段流：

1. planning (`runPlanning`)
   - 调包内 `createPlan`
   - 支持 `replanMode: none/full/partial`
   - 可能产生 `pendingApproval`
2. execution (`runExecution.executor`)
   - 调包内 `execute`
   - 记录 evidence/confidence/reviewNotes
   - 低置信度可触发 executor 审批
3. review (`runExecution.reviewer`)
   - 可选包内 `review`
   - 可做 schema 校验、证据校验
4. finalizer (`runExecution.finalizer`)
   - 生成 `TaskResult`
   - 调包内 `summarize`

故障路径：

- 任意阶段抛错走 `failTask()`，task.status=failed，trace 记录 `runtime.failed`。

---

## 6. Memory 与持久化模型

两类 memory：

- `structured`：plan/result/approvals（任务结构化回放）
- `semantic`：summary/evidence/packageId（语义检索线索）

Session 维度 memory（`SessionMemoryState`）：

- `facts`: core_theme / expressive_pool / dominant_layer / impact_policy / avoid_notes
- `artifacts`: intention / structureDraft / finalOutput
- `history`: 最近 10 个 task 摘要

同步策略：

- task 每次更新后 `syncSessionMemory()`
- task 完成后 `persistMemory()` 追加 memory record

---

## 7. 运行模式与服务层

`createRuntimeServices()` 根据 `AGENT_FOUNDRY_STORE_MODE` 选择：

- `in-memory`
  - TaskStore: `InMemoryTaskStore`
  - MemoryStore: `InMemoryMemoryStore`
- `durable`
  - TaskStore: `PostgresTaskStore`
  - MemoryStore: `RedisMemoryStore`

API 服务启动：

1. `apps/api/src/index.ts` 读取端口并 `buildApp()`
2. `buildApp()` 注入 runtime + orchestrator + routes
3. Fastify 对外提供 HTTP + SSE

---

## 8. 你离线阅读的推荐顺序（30 分钟版本）

1. `apps/workbench/app/playground.tsx`
2. `apps/workbench/app/use-agent-session.ts`
3. `apps/workbench/app/assistant-chat-surface.tsx`
4. `apps/workbench/app/api/chat/route.ts`
5. `apps/api/src/routes/session-routes.ts`
6. `apps/api/src/session-orchestrator.ts`
7. `packages/core/src/runtime/bootstrap.ts`
8. `packages/core/src/runtime/service.ts`
9. `packages/core/src/graph/planning.ts` + `execution.ts`
10. `packages/core/src/runtime/types.ts`

---

## 9. 当前架构特点（结论）

- 前端协议与 runtime 协议被 `SessionOrchestrator` 隔离，耦合控制较好。
- runtime 仍是唯一执行真源，API 主要做投影和编排。
- Session memory 真源已下沉 core，方向正确。
- 聊天流（/api/chat）与快照流（SSE）双轨并行，用户体验与工程可观测性兼顾。
