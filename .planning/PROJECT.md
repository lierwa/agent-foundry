# Agent Foundry

## 这是什么

Agent Foundry 是一个面向受控 Chat Agent Runtime 的 TypeScript monorepo。当前核心形态是“通用 runtime + 独立 agent packages + chat-driven operator workbench”，而不是把领域逻辑直接塞进 core。

## 核心价值

操作人员可以通过一套清晰的运行时契约，完整地创建、查看并安全推进 Agent 任务，并在关键节点进行人工确认。

## 项目要求

### 已验证能力

- [x] 可以从 workbench 创建任务，并驱动任务经过 planner、executor、reviewer、finalizer 全流程。
- [x] 可以在 planner 或 executor 阶段暂停，等待人工审批后继续。
- [x] Runtime 采用 package 化设计，后续可以继续接入新的 agent package。
- [x] perfume agent 已从 core 内嵌示例重构为独立 agent package。
- [x] workbench 已具备 chat-driven 调试工作台形态，可展示 intention、动态 plan、clarification、timeline。

### 当前重点

- [ ] 把当前 perfume agent 的启发式实现推进到真实模型驱动。
- [ ] 固化“新 agent package 接入协议”，确保 wardrobe 等新 agent 可以平移接入。
- [ ] 继续提升 workbench 的可观测性和调试效率。
- [ ] 让动态 plan、tool trace、clarification payload 的契约更稳定。

### 当前不做

- 终端用户认证和多租户权限控制
- plugin marketplace
- 大规模外部 provider 编排
- 正式生产级 CI/CD 与部署方案

## 背景上下文

- 当前仓库是 npm workspaces + TypeScript 的 monorepo。
- `apps/api` 是 Fastify 入口，对外暴露 runtime HTTP API。
- `apps/workbench` 是 Next.js 操作台，当前主页是三栏式 chat playground。
- `packages/core` 包含 runtime service、LangGraph 流程、storage adapter，以及通用 runtime 接口。
- `packages/agents/perfume` 是首个独立 agent package，包含 prompts、tools、knowledge、planner/executor/reviewer。
- `packages/shared` 定义 Zod schema 和跨应用共享契约。
- `perfume-knowledge` 存放 perfume 领域知识源，包括 `recommend.md`、香材数据库与分类定义。
- 仓库已经支持 in-memory / durable 两种 runtime storage。

## 约束条件

- **技术栈约束**：TypeScript、Fastify、Next.js、LangGraph、Zod 是既定基础。
- **运行时约束**：本地开发实际基线应为 Node 20+。
- **Brownfield 约束**：这不是空白项目，规划必须尊重现有目录边界和运行时契约。
- **开发体验约束**：根目录 workspace scripts 和 Docker 本地路径必须继续可用。

## 关键决策

| 决策 | 原因 | 当前结论 |
|------|------|----------|
| 通过 `AgentPackage` 保持 package 化 runtime | 为后续新 workflow 和受控能力扩展保留清晰入口 | ✓ 已确认 |
| API 和 workbench 继续分成两个 app，但共用一个仓库 | 后端和操作台可以独立演进，同时共享契约 | ✓ 已确认 |
| 先做持久化和验证，再扩 package 范围 | 先把底座稳定住，再扩 agent 能力 | ✓ 已完成第一轮 |
| Prompt 采用 Hybrid 方案 | 长规则用 `.md`，运行时上下文拼装用 `.ts` | ✓ 已确认 |
| 每个 agent 独立拥有 prompts / tools / knowledge / planner / executor / reviewer | 让新 agent 能以 package 方式平移接入，不污染 core | ✓ 已确认 |

---
*最后更新：2026-03-23，原因：同步独立 agent package、chat workbench 与 perfume 首版重构*
