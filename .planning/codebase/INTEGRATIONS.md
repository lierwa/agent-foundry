# External Integrations

**Analysis Date:** 2026-03-23

## APIs & Services

**Workbench -> API**
- 通过 `fetch` 调用 task / approval / package 接口
- Base URL: `NEXT_PUBLIC_API_BASE_URL`

**Runtime Storage**
- Postgres: 持久化 task
- Redis: 持久化 memory refs
- 两者都已通过 durable mode 接入 runtime

## Domain Knowledge

**Perfume Knowledge**
- 来源：本地文件
- 路径：
  - `perfume-knowledge/notes_info_with_profile_enriched.json`
  - `perfume-knowledge/definitions.ts`
  - `perfume-knowledge/recommend.md`
- 当前由 `packages/agents/perfume/src/knowledge/*` 读取和封装

## Model / Tool Layer

**Current State**
- prompt 体系和 tool protocol 已落地
- perfume agent 当前执行仍以启发式逻辑为主
- 尚未真正接入远程模型 provider

**Tool Trace**
- runtime 统一记录：
  - `tool.called`
  - `tool.completed`
  - `tool.failed`

## Deployment / Dev Infra

**Local Infra**
- `infra/docker-compose.yml`
- 支持 Postgres / Redis / API / workbench 的本地容器化路径

**Verification**
- `npm run typecheck`
- `npm run test`
- `npm run doctor`

## Auth / Monitoring

**Auth**
- 当前无认证

**Observability**
- 主要依赖：
  - Fastify logger
  - runtime trace
  - workbench timeline / state panels

---

*Integration audit: 2026-03-23*
