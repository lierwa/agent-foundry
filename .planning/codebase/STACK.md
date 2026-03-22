# Technology Stack

**Analysis Date:** 2026-03-22

## Languages

**Primary:**
- TypeScript 5.6.x - all application, runtime, and shared contract code in `apps/*` and `packages/*`

**Secondary:**
- JavaScript - Next.js config in `apps/workbench/next.config.js`
- Bash - developer tooling in `scripts/*.sh`
- YAML - Docker orchestration in `infra/docker-compose.yml`

## Runtime

**Environment:**
- Node.js 20.x intended for local development and tooling
- Root `package.json` allows `>=18.17.0`, but `scripts/dev-doctor.sh` hard-fails below Node 20

**Package Manager:**
- npm workspaces
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Fastify 4.28.1 - HTTP API in `apps/api/src/index.ts`
- Next.js 14.2.3 - operator workbench in `apps/workbench/app/*`
- React 18.3.1 - workbench UI components
- `@langchain/langgraph` 1.2.4 - planner/executor/reviewer/finalizer graphs in `packages/core/src/graph/*`
- Zod 3.23.8 - shared input, output, and task schemas in `packages/shared/src/index.ts`

**Testing:**
- No test framework configured yet

**Build/Dev:**
- TypeScript compiler via `tsc`
- `tsx` 4.19.2 for API watch mode

## Key Dependencies

**Critical:**
- `@langchain/langgraph` - runtime orchestration graph construction
- `fastify` - API server and route surface
- `next`, `react`, `react-dom` - operator-facing web UI
- `zod` - runtime validation of shared contracts and package I/O

**Infrastructure:**
- `@fastify/cors` - permissive local CORS handling for workbench-to-API calls
- Docker compose services for Postgres, Redis, API, and workbench via `infra/docker-compose.yml`

## Configuration

**Environment:**
- API port configurable through `PORT`
- Workbench API origin configurable through `NEXT_PUBLIC_API_BASE_URL`
- Example env files exist at `apps/api/.env.example` and `apps/workbench/.env.local.example`

**Build:**
- Root workspace scripts in `package.json`
- Shared TypeScript base config in `tsconfig.base.json`
- Per-package TypeScript configs in `apps/*/tsconfig.json` and `packages/*/tsconfig.json`

## Platform Requirements

**Development:**
- macOS, Linux, or Windows with Node 20+
- Optional Docker engine for Postgres and Redis-backed local services

**Production:**
- Dockerfiles exist for `apps/api` and `apps/workbench`
- Production hosting strategy is not defined yet; current repo is scaffold-ready rather than deployment-ready

---

*Stack analysis: 2026-03-22*
*Update after major dependency changes*
