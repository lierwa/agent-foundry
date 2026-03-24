# Workbench Architecture

## Summary

The workbench is now organized around a `session-first` chat flow:

- `UI layer` renders chat, plan strip, JSON inspector, and timeline.
- `Session API layer` translates chat actions into runtime calls and exposes SSE snapshots.
- `LangGraph runtime` still owns planner/executor/reviewer/finalizer orchestration.

The runtime remains task-based internally. The UI no longer talks to tasks directly; it talks to sessions.

## Layering

### 1. Workbench UI

Main files:

- `apps/workbench/app/playground.tsx`
- `apps/workbench/app/use-agent-session.ts`
- `apps/workbench/app/session-client.ts`

Responsibilities:

- `playground.tsx` is composition only.
- `use-agent-session.ts` owns network state, SSE subscription, optimistic chat state, and approval draft state.
- `session-client.ts` owns HTTP transport helpers.

Rendering split:

- `chat-thread.tsx`: chat messages only
- `plan-strip.tsx`: current plan titles + status
- `composer-panel.tsx`: input + approval interaction
- `state-sidebar.tsx`: JSON-first inspector
- `timeline-sidebar.tsx`: observability/event timeline

### 2. API / session service

Main files:

- `apps/api/src/app.ts`
- `apps/api/src/routes/*.ts`
- `apps/api/src/session-orchestrator.ts`

Responsibilities:

- `app.ts` only wires runtime, sessions, and route registration.
- `routes/system-routes.ts` exposes health/packages/models.
- `routes/task-routes.ts` preserves task-compatible routes.
- `routes/session-routes.ts` exposes the session-first API.
- `session-orchestrator.ts` maps UI sessions to runtime tasks and emits session snapshots.

### 3. LangGraph runtime

Main files:

- `packages/core/src/runtime/service.ts`
- `packages/core/src/graph/planning.ts`
- `packages/core/src/graph/execution.ts`

Responsibilities:

- The core runtime owns task lifecycle, approvals, trace, and final result persistence.
- The API layer does not replace the runtime; it wraps it.
- Structured model failures remain visible through trace events and are surfaced to sessions/UI.

## Current data flow

1. The UI creates a session if none exists.
2. The user sends a chat message through `/sessions/:sessionId/messages`.
3. `SessionOrchestrator` creates a runtime task and subscribes to it.
4. Runtime task updates are translated into a session snapshot.
5. The UI receives session snapshots over SSE and updates:
   - chat thread
   - plan strip
   - inspector
   - timeline

## Session memory

Current scope is conversation-only memory.

Stored in core runtime memory and projected into the session snapshot:

- `facts`
  - `core_theme`
  - `expressive_pool`
  - `dominant_layer`
  - `impact_policy`
  - `avoid_notes`
- `artifacts`
  - latest `intention`
  - latest `structureDraft`
  - latest `finalOutput`
- `history`
  - recent task summaries

Write path:

1. runtime updates task state
2. runtime syncs task-derived memory into `MemoryStore`
3. session orchestrator reads session memory from runtime/core
4. UI receives the latest session memory through session snapshots

This means session memory is no longer owned by the API orchestrator. The orchestrator now projects memory; the source of truth lives in `packages/core`.

Current limitation:

- in `in-memory` mode the session memory is still process-local
- in `durable` mode the session memory is stored through the memory adapter
- the current session abstraction is still created in the API layer, not as a first-class core `SessionStore`

## Vercel AI SDK decision

Decision for the current codebase:

- do **not** replace the current session SSE transport with Vercel AI SDK transport yet
- keep the existing `session-client.ts` + SSE pipeline as the transport boundary
- continue borrowing the `chat-first` interaction model from Vercel AI SDK style UIs

Reasoning:

- the runtime is LangGraph-first and emits task/session snapshots, approvals, timeline events, and inspector state
- Vercel AI SDK is strongest for text/tool streaming chat transport, but our current protocol is richer than a plain message stream
- forcing the runtime into AI SDK transport right now would add an adapter layer before the core session contract is fully stable

Recommended future path:

1. stabilize the session snapshot / event DTOs in `@agent-foundry/shared`
2. split `session.snapshot` into smaller event types if needed
3. only then evaluate whether AI SDK should sit on top as a UI transport adapter
4. if adopted, keep it confined to `apps/workbench/app/session-client.ts` and related adapters, not inside the core runtime

## Design rules

- Chat stays user-facing: only `user`, `assistant`, `thought`, and `error` belong in the center thread.
- Plan is not a chat message; it lives in the middle plan strip.
- Inspector is JSON-first and does not duplicate timeline or chat content.
- Timeline is for engineering observability, not primary interaction.
- The API should keep route registration thin; handler logic belongs in route modules or service classes.

## Next cleanup candidates

- Add route-level tests for session endpoints.
- Extract session snapshot DTOs into `@agent-foundry/shared` once the shape stabilizes.
- Add a first-class `SessionStore` if sessions themselves need to survive API restarts.
- If Vercel AI SDK is introduced later, keep `session-client.ts` as the adapter boundary.
