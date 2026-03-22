# Codebase Structure

**Analysis Date:** 2026-03-23

## Directory Layout

```text
agent-foundry/
├── .codex/
├── .planning/
├── apps/
│   ├── api/
│   └── workbench/
├── infra/
├── packages/
│   ├── agents/
│   │   └── perfume/
│   ├── core/
│   └── shared/
├── perfume-knowledge/
├── scripts/
├── package.json
├── tsconfig.base.json
└── README.md
```

## Directory Purposes

**apps/api**
- Fastify API
- 注册 runtime 与 agent packages

**apps/workbench**
- Next.js operator UI
- 首页是 chat-driven playground

**packages/core**
- 通用 runtime
- graph、registry、service、adapters
- 不再承载 perfume 领域实现

**packages/agents/perfume**
- 独立 perfume agent package
- 包含：
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

**packages/shared**
- 共享 schema 与类型

**perfume-knowledge**
- perfume 领域知识源
- 当前关键文件：
  - `recommend.md`
  - `notes_info_with_profile_enriched.json`
  - `definitions.ts`

## Where to Add New Code

**New Runtime Capability**
- `packages/core/src/runtime/`
- `packages/core/src/graph/`
- `packages/shared/src/index.ts`

**New Agent**
- `packages/agents/<agent-id>/`
- 保持与 perfume 同构的目录结构

**New Domain Knowledge**
- 独立知识目录，例如 `wardrobe-knowledge/`

**Workbench Enhancements**
- `apps/workbench/app/`

---

*Structure analysis: 2026-03-23*
