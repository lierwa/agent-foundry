---
phase: 01-runtime-persistence-and-validation
plan: 01
subsystem: runtime
tags: [postgres, redis, fastify, runtime, persistence]
requires: []
provides:
  - Durable Postgres-backed task persistence behind the existing TaskStore contract
  - Durable Redis-backed memory persistence behind the existing MemoryStore contract
  - Runtime bootstrap that selects in-memory or durable storage from explicit configuration
affects: [api, testing, docs]
tech-stack:
  added: [pg, redis]
  patterns:
    - Configuration-driven runtime storage selection
    - Durable adapters hidden behind stable runtime interfaces
key-files:
  created: [packages/core/src/runtime/bootstrap.ts]
  modified:
    - packages/core/package.json
    - packages/core/src/adapters/postgres.ts
    - packages/core/src/adapters/redis.ts
    - packages/core/src/index.ts
    - apps/api/src/index.ts
    - apps/api/.env.example
key-decisions:
  - "Kept TaskStore and MemoryStore method signatures unchanged while adding durable adapters."
  - "Selected durable mode through AGENT_FOUNDRY_STORE_MODE with DATABASE_URL and REDIS_URL as explicit prerequisites."
patterns-established:
  - "Runtime bootstrap owns store construction so API entrypoints do not hardcode adapter classes."
  - "Durable adapters serialize canonical records without changing AgentRuntimeService call sites."
requirements-completed: [PLAT-01, PLAT-02, PLAT-03]
duration: 3min
completed: 2026-03-22
---

# Phase 01: Runtime Persistence And Validation Summary

**Durable Postgres and Redis runtime adapters with a configuration-driven bootstrap path for the API**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T11:20:25Z
- **Completed:** 2026-03-22T11:23:27Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added `pg` and `redis` dependencies plus durable task and memory adapters in `@agent-foundry/core`.
- Introduced `createRuntimeServices()` so the API can switch between in-memory and durable stores from env configuration.
- Preserved the existing runtime service contract while mapping durable storage through the same TaskStore and MemoryStore methods.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add durable storage dependencies and adapter modules** - `ed508d8` (feat)
2. **Task 2: Add runtime bootstrap for store selection** - `ce2b06e` (feat)
3. **Task 3: Preserve compatibility with existing runtime contracts** - `424fa64` (feat)

## Files Created/Modified

- `packages/core/src/runtime/bootstrap.ts` - Creates runtime services from explicit storage mode configuration.
- `packages/core/src/adapters/postgres.ts` - Implements durable task persistence backed by Postgres.
- `packages/core/src/adapters/redis.ts` - Implements durable memory persistence backed by Redis lists.
- `apps/api/src/index.ts` - Uses the runtime bootstrap instead of constructing in-memory stores inline.
- `apps/api/.env.example` - Documents durable runtime environment variables and local defaults.

## Decisions Made

- Kept persistence behind the existing runtime interfaces so downstream runtime logic stays unchanged.
- Required durable-mode env vars up front rather than silently falling back when configuration is incomplete.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required beyond the documented local env values.

## Next Phase Readiness

Wave 2 can now add runtime and API verification against the new bootstrap path without changing the public runtime contract.
No blockers identified from this plan.

## Self-Check: PASSED

- `bash scripts/with-node20.sh npm --workspace @agent-foundry/core run typecheck`
- `bash scripts/with-node20.sh npm --workspace @agent-foundry/api run typecheck`
- `rg -n "AGENT_FOUNDRY_STORE_MODE|DATABASE_URL|REDIS_URL" packages/core/src/runtime/bootstrap.ts apps/api/src/index.ts apps/api/.env.example`

---
*Phase: 01-runtime-persistence-and-validation*
*Completed: 2026-03-22*
