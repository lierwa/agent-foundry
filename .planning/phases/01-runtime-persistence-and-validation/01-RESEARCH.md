# Phase 1: Runtime Persistence And Validation - Research

**Researched:** 2026-03-22
**Domain:** durable runtime storage and automated verification for a TypeScript Fastify/LangGraph monorepo
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

No phase-specific `CONTEXT.md` exists yet. Planning is based on the existing codebase, roadmap, and requirements.

### Locked Decisions
- Keep the current monorepo shape: `apps/api`, `apps/workbench`, `packages/core`, `packages/shared`.
- Preserve the existing `TaskStore` and `MemoryStore` interfaces instead of hard-coding persistence into the runtime.
- Use the Docker-ready infrastructure that already exists in `infra/docker-compose.yml` rather than introducing unrelated external services.

### the agent's Discretion
- Choose the concrete Node clients for Postgres and Redis.
- Choose the test runner and test file layout.
- Decide whether to default to durable mode or offer explicit local fallback via configuration.

### Deferred Ideas (OUT OF SCOPE)
- End-user auth and multi-tenant controls
- Real-time workbench updates
- Expanding to multiple new package types in this phase
</user_constraints>

<research_summary>
## Summary

Phase 1 is best treated as infrastructure hardening around two seams the repo already exposes: storage interfaces and runtime verification. The code already has `TaskStore` and `MemoryStore` abstractions in `packages/core/src/runtime/types.ts`, so the lowest-risk path is to keep those interfaces and add production-shaped implementations rather than redesigning the runtime.

For storage, the cleanest fit is `pg` for Postgres-backed task state and `redis` for memory references. `node-postgres` gives direct parameterized SQL access without forcing an ORM or schema migration framework into this scaffold yet. Redis now recommends `node-redis` for new Node.js work; that makes it the safer default over `ioredis` for a new integration. The runtime should gain a small bootstrap/factory layer so `apps/api/src/index.ts` chooses in-memory or durable adapters from env vars instead of instantiating stores inline.

For verification, a dedicated TS/ESM-friendly test runner is the pragmatic choice. Fastify's own testing guide centers `app.inject()` for route tests, and Vitest is explicitly positioned as working for backend code with out-of-box TypeScript and ESM support. That combination supports fast unit tests for `packages/core` plus API contract tests against an extracted `buildApp()` function from the Fastify entrypoint.

**Primary recommendation:** add a configuration-driven runtime bootstrap using `pg` + `redis`, then install Vitest and Fastify inject-style API tests as the phase's verification baseline.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | current stable | Postgres client for task persistence | `node-postgres` is the de facto low-level Postgres client for Node and supports parameterized queries directly. |
| `redis` | current stable | Redis client for memory record persistence | Redis docs now steer new Node projects toward `node-redis` rather than `ioredis`. |
| `vitest` | current stable | TypeScript/ESM-friendly unit and integration test runner | Official docs position it as working for backend code, not just Vite frontends. |
| Fastify `app.inject()` | built-in | API route testing without booting a real server | Fastify's testing guide recommends HTTP injection for route verification. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` | already present | run TS files in dev without build | keep for dev server; not necessary for tests if Vitest is added |
| `node:test` | built into Node 20 | alternative lightweight test runner | acceptable for pure Node modules, but weaker fit here because the repo is TS + ESM across packages |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pg` | Prisma / Drizzle | higher-level schema tooling, but adds more surface area than this scaffold needs in Phase 1 |
| `redis` | `ioredis` | still viable, but Redis docs now prefer `node-redis` for new work |
| Vitest | Node built-in test runner | fewer dependencies, but more friction for TS/ESM monorepo tests and mocking ergonomics |

**Installation:**
```bash
npm install -D vitest
npm install --workspace @agent-foundry/core pg redis
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```text
packages/core/src/
├── adapters/
│   ├── in-memory.ts
│   ├── postgres.ts
│   └── redis.ts
├── runtime/
│   ├── bootstrap.ts
│   ├── registry.ts
│   ├── service.ts
│   └── types.ts
└── ...
```

### Pattern 1: Interface-preserving adapter expansion
**What:** Add durable implementations behind the existing `TaskStore` and `MemoryStore` interfaces.
**When to use:** When the runtime contract is already clean and the goal is durability, not behavior redesign.
**Example:** keep `AgentRuntimeService` constructor shape unchanged and swap adapters at bootstrap time.

### Pattern 2: Extract Fastify app construction from server listen
**What:** Move route registration into a `buildApp()` helper and keep `listen()` in the executable entrypoint.
**When to use:** When route tests should use Fastify injection without binding a real network port.
**Example:** Fastify testing docs show creating an app instance and calling `app.inject({ method, url, payload })`.

### Anti-Patterns to Avoid
- **Adapter leakage into runtime code:** do not branch on Postgres/Redis logic inside `AgentRuntimeService`; keep storage selection in bootstrap.
- **Introducing full ORM/migration complexity too early:** this phase is about durability and verification, not long-term data modeling.
- **Writing tests only against manual server startup:** prefer direct injection and direct service tests so regression checks stay fast.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Postgres connection pooling | custom socket/query layer | `pg` pool/client | retries, pooling, and parameterized query support already exist |
| Redis protocol access | raw TCP command wrappers | `redis` client | reconnection and command coverage are already solved |
| HTTP API test transport | custom fetch-to-local-server harness | Fastify `inject()` | no port management, plugins are fully booted for tests |
| TS/ESM test execution | shell wrappers around `node --test` + loaders | Vitest | simpler TS + ESM support and mocking in this monorepo |

**Key insight:** this repo already has the right architectural seams; Phase 1 should fill them with standard clients and test tooling, not invent new infrastructure layers.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Mixing bootstrapping and runtime behavior
**What goes wrong:** storage client setup creeps into route files or runtime methods.
**Why it happens:** easiest path is to instantiate clients where they're first needed.
**How to avoid:** centralize env parsing and adapter construction in one bootstrap module.
**Warning signs:** `process.env` and connection logic appear in multiple files.

### Pitfall 2: Persistence schema that mirrors in-memory objects too loosely
**What goes wrong:** serialized task state becomes inconsistent or hard to query.
**Why it happens:** dumping JSON blobs without deciding what must stay structured.
**How to avoid:** keep canonical task records structured enough to list/get/update reliably; use JSON only where shape is naturally nested.
**Warning signs:** list queries need full-record deserialization just to sort or filter.

### Pitfall 3: Slow or fragile route tests
**What goes wrong:** tests start real servers or depend on external containers for every run.
**Why it happens:** testing follows manual runtime steps too literally.
**How to avoid:** keep most tests on in-memory or mocked boundaries; reserve container-backed tests for later if needed.
**Warning signs:** test setup requires `docker compose up` before any local verification.
</common_pitfalls>

<code_examples>
## Code Examples

### Fastify injection testing
Source: Fastify Testing Guide — https://fastify.dev/docs/v5.7.x/Guides/Testing/

```ts
const app = buildApp();
const response = await app.inject({
  method: "GET",
  url: "/health",
});
```

### Redis client connection
Source: Redis node-redis guide — https://redis.io/docs/latest/develop/clients/nodejs/

```ts
import { createClient } from "redis";

const client = createClient({ url: process.env.REDIS_URL });
client.on("error", (err) => console.error(err));
await client.connect();
```

### Parameterized Postgres query
Source: node-postgres queries docs — https://node-postgres.com/features/queries

```ts
await pool.query("select * from tasks where task_id = $1", [taskId]);
```
</code_examples>

<sota_updates>
## State of the Art (2024-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| prefer `ioredis` by default | prefer `node-redis` for new Node Redis work | current Redis docs and migration guidance | new integration should start on `redis` unless a missing feature forces otherwise |
| treat Node test runner as experimental | Node 20 test runner is stable | Node 20 | makes built-in testing viable, though still not the easiest fit for this repo |
| frontend-only view of Vitest | Vitest explicitly supports backend use too | current docs | good fit for mixed TS/ESM monorepos like this one |

**New tools/patterns to consider:**
- `must_haves`-driven verification in plans so execution can verify artifacts and links after code lands
- extracting `buildApp()` from `listen()` so API tests stay fast and deterministic

**Deprecated/outdated:**
- treating `ioredis` as the default Redis client for new Node work
</sota_updates>

<open_questions>
## Open Questions

1. **Where should durable task state live exactly?**
   - What we know: Postgres and Redis are both available in local infra, and the repo already mentions Postgres/Redis-oriented abstractions.
   - What's unclear: whether memory records belong fully in Redis or whether task + memory should both live in Postgres with Redis only as cache.
   - Recommendation: Phase 1 planning should default to Postgres for tasks and Redis for memory records/reference lookup to match the existing architectural intent.

2. **How much of the test baseline should include workbench UI now?**
   - What we know: roadmap Phase 1 explicitly asks for runtime and API coverage.
   - What's unclear: whether browser/UI tests are worth adding before operator UX improvements in Phase 2.
   - Recommendation: keep Phase 1 automated verification focused on `packages/core` and `apps/api`; defer workbench interaction tests unless they are needed to protect a specific bug.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- Fastify Testing Guide — https://fastify.dev/docs/v5.7.x/Guides/Testing/ — route testing via `app.inject()`
- Vitest Features — https://vitest.dev/guide/features — backend-compatible TS/ESM test support
- Vitest Mocking Guide — https://vitest.dev/guide/mocking — mocking approach and reset guidance
- Redis node-redis guide — https://redis.io/docs/latest/develop/clients/nodejs/ — installation and connection flow
- Redis migration guide — https://redis.io/docs/latest/develop/clients/nodejs/migration/ — `ioredis` deprecation guidance for new work
- node-postgres queries docs — https://node-postgres.com/features/queries — parameterized query model

### Secondary (MEDIUM confidence)
- Node.js test runner docs — https://nodejs.org/download/release/v20.19.0/docs/api/test.html — built-in runner capabilities
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: runtime persistence and automated verification
- Ecosystem: Postgres/Redis Node clients, Fastify testing, TS test runner options
- Patterns: adapter bootstrap, API injection tests, requirement-linked validation
- Pitfalls: schema drift, bootstrap sprawl, slow test setup

**Confidence breakdown:**
- Standard stack: HIGH - based on official docs and current repo constraints
- Architecture: HIGH - based on existing interface boundaries in the codebase
- Pitfalls: MEDIUM - inferred from common failures in similar scaffolds
- Code examples: HIGH - drawn from primary docs

**Research date:** 2026-03-22
**Valid until:** 2026-04-21
</metadata>

---
