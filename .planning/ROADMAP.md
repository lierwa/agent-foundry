# 路线图：Agent Foundry

## 总览

当前项目已经完成两次关键转折：

1. 先把 runtime 做成可持久化、可验证的基础底座
2. 再把 perfume 从 core 内嵌 demo 重构成独立 agent package，并把 workbench 改成 chat-driven playground

后续路线图不再围绕“简单工作流 demo”，而是围绕“可复用的 agent package 平台”推进。

## 阶段列表

- [x] **Phase 1：Runtime 持久化与验证基线**
- [x] **Phase 2：操作体验与可观测性首版**
- [x] **Phase 3：Agent Package 化与 Perfume 重构首版**
- [ ] **Phase 4：Perfume Agent 智能化与契约收敛**
- [ ] **Phase 5：多 Agent 扩展验证**

## 阶段详情

### Phase 1：Runtime 持久化与验证基线
**状态：** 已完成  
**结果：**
- durable mode 可用
- `npm run test` / `npm run typecheck` 可用
- runtime / API 回归基线已建立

### Phase 2：操作体验与可观测性首版
**状态：** 已完成  
**结果：**
- workbench 首页改为三栏 playground
- chat / plan / timeline / state / memory 可视化打通
- 桌面端可控制在一屏内，模块内部滚动

### Phase 3：Agent Package 化与 Perfume 重构首版
**状态：** 已完成  
**结果：**
- `core` 不再内嵌 perfume 业务
- `packages/agents/perfume` 成为独立 workspace package
- prompt 采用 Hybrid 方案
- tools / knowledge / planner / executor / reviewer 分层落地
- perfume 输入改为自然语言 brief
- planner 可生成 intention 与 clarification
- executor 基于本地知识源构造候选池并输出六层 JSON

### Phase 4：Perfume Agent 智能化与契约收敛
**状态：** 进行中  
**目标：**
- 把 perfume agent 从启发式逻辑推进到真实模型驱动
- 稳定 `intention`、`clarification`、`candidatePool`、`structureDraft` 的 schema 和演化路径
- 让 tool trace、plan.updated、candidate_pool.updated、structure.composed 的语义更稳定
- 让 reviewer 更严格对齐 `perfume-knowledge/recommend.md`

计划：
- [ ] 04-01：接入真实模型调用和 prompt 执行链路
- [ ] 04-02：收紧 perfume 输出校验与 review 规则
- [ ] 04-03：优化 workbench 对 intention / clarification / tool trace 的展示

### Phase 5：多 Agent 扩展验证
**状态：** 未开始  
**目标：**
- 用第二个 agent 验证 package 化架构是否真的可复用
- 证明新增 agent 时不需要修改 runtime 主干
- 固化 agent package 接入模板

计划：
- [ ] 05-01：建立 wardrobe agent skeleton
- [ ] 05-02：文档化新 agent 接入协议与模板

## 进度

| Phase | 状态 |
|------|------|
| 1. Runtime 持久化与验证基线 | Done |
| 2. 操作体验与可观测性首版 | Done |
| 3. Agent Package 化与 Perfume 重构首版 | Done |
| 4. Perfume Agent 智能化与契约收敛 | In progress |
| 5. 多 Agent 扩展验证 | Not started |
