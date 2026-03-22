# 项目状态

## 项目引用

见：`.planning/PROJECT.md`（最后更新：2026-03-23）

**核心价值：** 操作人员可以通过一套清晰的运行时契约，完整地创建、查看并安全推进 Agent 任务。  
**当前焦点：** Phase 4 - Perfume Agent 智能化与契约收敛

## 当前位置

**当前阶段：** Phase 4 / 共 5 个阶段（Perfume Agent 智能化与契约收敛）  
**当前计划：** 待规划  
**当前状态：** Runtime package 化和 perfume 首版 chat agent 已落地，当前进入契约收敛与模型驱动阶段。  
**最后活动：** 2026-03-23 - 已完成独立 perfume agent package、Hybrid prompt、tool trace、chat-driven workbench 与六层输出首版接入。

## 进度指标

**里程碑状态：**
- Phase 1：Done
- Phase 2：Done
- Phase 3：Done
- Phase 4：In progress
- Phase 5：Not started

**最近趋势：**
- 最近关键活动：Phase 1 完成；workbench 改造完成；perfume agent package 化完成
- 趋势：项目已经从“持久化基线”转入“agent 架构与领域能力深化”

## 累积上下文

### 关键决策

- 在仓库内采用 GSD brownfield 规划方式，而不是只靠聊天记录推进。
- 先做持久化和验证，再扩 package 范围。
- core 只保留通用 runtime，具体 agent 以独立 workspace package 接入。
- prompt 采用 Hybrid 方案，长规则用 `.md`，运行时拼装用 `.ts`。
- workbench 以 chat 为主交互，不在 perfume 输入区暴露固定参数表单。

### 阻塞 / 风险

- perfume agent 当前仍是启发式实现，尚未接入真实模型调用。
- `intention` / `clarification` / `candidatePool` / 六层输出的 schema 语义还需要继续收敛。
- 目前只有一个独立 agent package，尚未用第二个 agent 验证扩展路径。

## 每天如何继续

**今天如果重新开始开发：**
1. 先看这个 `STATE.md`
2. 再看 `ROADMAP.md`
3. 然后进入当前 phase 的讨论或规划

**当前下一步：**
- 正式规划 Phase 4
- 决定 perfume agent 的模型接入方式
- 收紧 reviewer 对 `recommend.md` 的对齐校验
- 继续完善 workbench 对 clarification / tool trace / 结构草案的展示

## 会话延续

**上次开发时间：** 2026-03-23  
**停在这里：** 独立 perfume agent package、chat-driven workbench 和新共享 schema 已经落地并通过测试。  
**下次第一步：** 先为 Phase 4 做正式讨论/规划，再决定是真接模型还是先补 perfume 规则与 UI 调试契约。  
**恢复文件：** `packages/agents/perfume/src/manifest.ts`
