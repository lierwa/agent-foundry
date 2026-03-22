---
phase: 1
slug: runtime-persistence-and-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` — Wave 0 install |
| **Quick run command** | `bash scripts/with-node20.sh npx vitest run packages/core apps/api --passWithNoTests` |
| **Full suite command** | `bash scripts/with-node20.sh npm run test` |
| **Estimated runtime** | ~20-40 seconds initially |

---

## Sampling Rate

- **After every task commit:** Run `bash scripts/with-node20.sh npx vitest run packages/core apps/api --passWithNoTests`
- **After every plan wave:** Run `bash scripts/with-node20.sh npm run test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | PLAT-01 | integration | `bash scripts/with-node20.sh npx vitest run packages/core` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | PLAT-02 | integration | `bash scripts/with-node20.sh npx vitest run packages/core` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | PLAT-03 | integration | `bash scripts/with-node20.sh npx vitest run packages/core apps/api` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | QUAL-01 | unit/integration | `bash scripts/with-node20.sh npx vitest run packages/core` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 2 | QUAL-02 | api | `bash scripts/with-node20.sh npx vitest run apps/api` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 2 | QUAL-03 | verification | `bash scripts/with-node20.sh npm run test` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 3 | PLAT-03 | docs/config | `rg -n \"DATABASE_URL|REDIS_URL|npm run test\" README.md apps/api/.env.example package.json` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — root Vitest config for workspace-aware runs
- [ ] `packages/core/src/**/*.test.ts` or `packages/core/test/**/*.test.ts` — runtime lifecycle tests
- [ ] `apps/api/src/**/*.test.ts` or `apps/api/test/**/*.test.ts` — Fastify route tests using injection
- [ ] `package.json` root `test` script — consistent full-suite entrypoint

*Existing infrastructure does not yet cover any Phase 1 requirements automatically.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Durable mode boots cleanly against local Docker services | PLAT-03 | needs local infra and human confirmation of workflow readiness | Start `npm run docker:up`, then run API in durable mode and confirm `/health`, `/tasks`, and task creation still work |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
