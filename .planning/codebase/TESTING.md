# Testing Patterns

**Analysis Date:** 2026-03-22

## Test Framework

**Runner:**
- None configured yet

**Assertion Library:**
- None configured yet

**Run Commands:**
```bash
npm run typecheck   # Current static verification baseline
npm run build       # Current compile/build baseline
```

## Test File Organization

**Location:**
- No `*.test.*`, `tests/`, or e2e directories are present in the repo source today

**Naming:**
- Not established yet

## Test Structure

**Current state:**
- Verification is currently manual plus TypeScript compilation
- The workbench and runtime behavior are exercised by running the apps locally

## Mocking

**Framework:**
- Not established yet

**What to Mock first when tests are added:**
- Package execution boundaries for runtime service tests
- Fastify request/response boundaries for API tests
- Browser-network interactions for workbench tests

**What not to mock first:**
- Zod schemas and plain transformation logic
- The in-memory adapters when testing runtime lifecycle semantics

## Fixtures and Factories

**Current state:**
- No shared fixtures or factories exist

**Likely useful first factories:**
- Task payload factory for `createTaskSchema`
- Approval request / approval event fixtures
- Package registry bootstrap helper for runtime tests

## Coverage

**Requirements:**
- No coverage target exists yet
- Roadmap Phase 1 should establish the first automated baseline

## Test Types

**Needed next:**
- Unit/integration tests for `packages/core/src/runtime/service.ts`
- Route contract tests for `apps/api/src/index.ts`
- Minimal workbench interaction coverage for create-task and approval flows

## Common Patterns

**Current validation commands:**
- `npm run typecheck`
- `npm run build`
- `npm run doctor`

**Gap to close:**
- There is no command today that proves planner/executor/reviewer/finalizer behavior stays correct after changes

---

*Testing analysis: 2026-03-22*
*Update when test patterns change*
