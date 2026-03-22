# 需求清单：Agent Foundry

**定义时间：** 2026-03-22  
**核心价值：** 操作人员可以通过一套清晰的运行时契约，完整地创建、查看并安全推进 Agent 任务。

## v1 需求

### 平台 Runtime

- [x] **PLAT-01**：任务状态在 API 重启后仍然保留。
- [x] **PLAT-02**：Runtime memory 记录在 API 重启后仍然保留。
- [x] **PLAT-03**：Runtime 启动时可以在 in-memory / durable 模式之间切换。
- [ ] **PLAT-04**：任务创建、执行和审批失败时，runtime 能输出可操作的日志和错误响应。
- [x] **PLAT-05**：core 不承载 perfume 等领域逻辑，具体 agent 以独立 package 接入。
- [ ] **PLAT-06**：runtime 支持动态 plan 更新、tool trace 和 clarification payload 的稳定契约。

### 操作台 Workbench

- [x] **WB-01**：操作人员可以直接从 workbench 创建任务。
- [x] **WB-02**：操作人员可以在 workbench 中查看 plan、待审批内容、result 和 trace。
- [ ] **WB-03**：当任务创建失败或审批提交失败时，操作人员能收到清晰反馈。
- [x] **WB-04**：workbench 以 chat 形式驱动 perfume 用例，而不是固定参数表单。
- [ ] **WB-05**：workbench 能清晰展示 intention、clarification、candidate pool、tool trace 和结构草案。

### 质量与验证

- [x] **QUAL-01**：`packages/core` 生命周期有自动化测试覆盖。
- [x] **QUAL-02**：Fastify task API 的成功路径和失败路径有自动化测试覆盖。
- [x] **QUAL-03**：根目录 workspace 命令里接入统一自动化验证入口。
- [x] **QUAL-04**：独立 perfume agent package 有基础单元测试覆盖。

### Package 可扩展性

- [x] **PKG-01**：在做完持久化和验证加固后，perfume package 仍然可以正常工作。
- [ ] **PKG-02**：新增 package 时，在 `packages/core`、`packages/shared`、workbench 三层有明确可遵循的接入模式。
- [ ] **PKG-03**：新增 agent 时，只需新增一个独立 package 目录并注册，不需要改 runtime 主干。
- [ ] **PKG-04**：每个 agent package 都有统一的 prompts / tools / knowledge / planner / executor / reviewer 结构。

### Agent 能力

- [x] **AGENT-01**：perfume agent 通过自然语言 brief 启动，不依赖固定调香参数输入。
- [x] **AGENT-02**：perfume agent 可以在运行中生成 intention、clarification、candidate pool 和六层结构草案。
- [ ] **AGENT-03**：perfume agent 需要逐步从启发式实现过渡到真实模型驱动。
- [ ] **AGENT-04**：最终输出需稳定对齐 `perfume-knowledge/recommend.md` 的六层 JSON 约定。

## v2 需求

- **PROD-01**：为操作台和 runtime endpoint 增加操作人员认证与角色控制。
- **PROD-02**：workbench 可以收到实时任务更新，而不是依赖刷新。
- **PROD-03**：除了 perfume 之外，再落地多个真实 agent package，并包含各自的 tools 与 knowledge adapters。
- **INF-01**：CI 能在每次变更时执行 build、typecheck、test。
- **INF-02**：正式部署目标和环境策略被文档化且可复现。

## 当前不做

| 功能 | 原因 |
|------|------|
| 面向最终用户的产品 UI | 当前 UI 是操作台，用来查看 runtime 和处理审批。 |
| 通用 plugin marketplace | 现在 package 注册仍应保持代码级接入，先把核心契约稳定下来。 |
| 大规模外部 LLM/provider 编排 | 当前阶段优先解决 runtime 形态、agent 契约和调试体验。 |

## 需求追踪

| 需求 | 所属阶段 | 状态 |
|------|----------|------|
| PLAT-01 | Phase 1 | Done |
| PLAT-02 | Phase 1 | Done |
| PLAT-03 | Phase 1 | Done |
| QUAL-01 | Phase 1 | Done |
| QUAL-02 | Phase 1 | Done |
| QUAL-03 | Phase 1 | Done |
| WB-01 | Phase 2 | Done |
| WB-02 | Phase 2 | Done |
| WB-03 | Phase 2 | Pending |
| WB-04 | Phase 2 | Done |
| WB-05 | Phase 2 | Pending |
| PLAT-04 | Phase 2 | Pending |
| PLAT-05 | Phase 3 | Done |
| PLAT-06 | Phase 3 | Pending |
| PKG-01 | Phase 3 | Done |
| PKG-02 | Phase 3 | Pending |
| PKG-03 | Phase 3 | Pending |
| PKG-04 | Phase 3 | Pending |
| QUAL-04 | Phase 3 | Done |
| AGENT-01 | Phase 3 | Done |
| AGENT-02 | Phase 3 | Done |
| AGENT-03 | Phase 4 | Pending |
| AGENT-04 | Phase 4 | Pending |

**覆盖情况：**
- v1 需求总数：22
- 已映射到 phase：22
- 未映射：0

---
*需求定义时间：2026-03-22*  
*最后更新：2026-03-23，原因：同步独立 agent package、chat workbench 和 perfume 首版重构*
