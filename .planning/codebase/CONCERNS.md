# Codebase Concerns

**Analysis Date:** 2026-03-22

## Tech Debt

**In-memory persistence only:**
- Issue: `InMemoryTaskStore` and `InMemoryMemoryStore` are the only implementations in `packages/core/src/adapters/in-memory.ts`
- Why: The repo is still scaffold-stage and optimized for local demos
- Impact: API restarts lose all task state and memory references
- Fix approach: Add durable adapters and configuration-driven runtime bootstrap

**Single-file API bootstrap:**
- Issue: `apps/api/src/index.ts` holds server setup, route definitions, package registry setup, and runtime wiring in one file
- Why: Fast initial scaffold
- Impact: Endpoint growth and environment-specific wiring will become harder to test and evolve
- Fix approach: Extract route modules and bootstrap composition helpers once persistence work starts

**Shared schema concentration:**
- Issue: `packages/shared/src/index.ts` contains all schemas and inferred types in one large module
- Why: Early-stage convenience
- Impact: Package growth will increase merge pressure and make contract ownership fuzzy
- Fix approach: Split schemas by domain while keeping a barrel export

## Known Bugs

**Task state is process-local:**
- Symptoms: Existing tasks disappear after API restart
- Trigger: restarting `apps/api`
- Workaround: recreate the task manually
- Root cause: in-memory store implementation only

**Workbench error messages are generic:**
- Symptoms: create-task and approval failures usually show generic messages rather than actionable detail
- Trigger: non-OK responses in `apps/workbench/app/task-create-form.tsx` and `apps/workbench/app/tasks/[taskId]/task-approval-form.tsx`
- Workaround: inspect API logs or network payloads manually
- Root cause: shallow error handling in UI components

## Security Considerations

**Unauthenticated operator surface:**
- Risk: any client reaching the API can list packages, create tasks, inspect tasks, and submit approvals
- Current mitigation: none in code; local/dev usage assumed
- Recommendations: add authentication before exposing beyond trusted environments

**Permissive CORS:**
- Risk: `origin: true` in `apps/api/src/index.ts` allows broad cross-origin access patterns
- Current mitigation: local development assumption
- Recommendations: restrict allowed origins by environment once deployment exists

## Performance Bottlenecks

**In-memory growth:**
- Problem: task and memory records accumulate in process memory for the lifetime of the API
- Cause: no pruning, paging, or durable backing store
- Improvement path: move to database-backed stores and paginate listing endpoints

**Workbench task detail rendering:**
- Problem: large payloads are rendered as raw JSON blobs
- Cause: operator UI is scaffold-level and not optimized for large traces/results
- Improvement path: structured panels, collapsible sections, and trace filtering

## Fragile Areas

**Runtime service orchestration:**
- Why fragile: `packages/core/src/runtime/service.ts` coordinates planning, approval branching, execution, review, finalization, tracing, and persistence
- Common failures: a small change can alter task status transitions or trace shape
- Safe modification: add lifecycle tests before refactoring; keep branching behavior explicit
- Test coverage: none today

**Package output contract:**
- Why fragile: package execution and summary logic depend on shared schemas and runtime expectations lining up
- Common failures: schema drift between `packages/shared` and package/runtime code
- Safe modification: change schemas and package logic together; validate outputs in tests
- Test coverage: none today

## Scaling Limits

**Single-process API:**
- Current capacity: bounded by one Fastify process and in-memory state
- Limit: horizontal scaling will duplicate or lose runtime state without shared persistence
- Symptoms at limit: inconsistent task visibility and approval handling across instances
- Scaling path: central task store, memory store, and eventually queue-backed execution

## Dependencies at Risk

**LangGraph adoption depth:**
- Risk: orchestration is concentrated in a few files, so upgrades to `@langchain/langgraph` may have outsized impact
- Impact: planner/executor graph definitions and runtime state transitions
- Migration plan: add runtime tests before version upgrades

## Missing Critical Features

**Automated tests:**
- Problem: no runtime regression suite exists
- Current workaround: manual exercise through API and workbench
- Blocks: safe refactoring of runtime orchestration and UI flow
- Implementation complexity: medium

**Durable persistence path:**
- Problem: infrastructure services exist but the runtime does not use them
- Current workaround: keep demos in one process lifetime
- Blocks: restart safety and production-like local development
- Implementation complexity: medium to high

## Test Coverage Gaps

**Runtime lifecycle:**
- What's not tested: planning, approval pauses, execution confidence branching, finalization
- Risk: status transitions can break unnoticed
- Priority: High
- Difficulty to test: Medium

**API contract:**
- What's not tested: request validation, 404 behavior, approval error responses
- Risk: UI can break on silent contract drift
- Priority: High
- Difficulty to test: Low to medium

**Workbench flows:**
- What's not tested: task creation, task detail rendering, approval submissions
- Risk: operator regressions only show up manually
- Priority: Medium
- Difficulty to test: Medium

---

*Concerns audit: 2026-03-22*
*Update as issues are fixed or new ones are discovered*
