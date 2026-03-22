# Coding Conventions

**Analysis Date:** 2026-03-22

## Naming Patterns

**Files:**
- kebab-case for modules and React components stored as files
- `index.ts` for public package exports and app entry points
- shell scripts use kebab-case with `.sh`

**Functions:**
- camelCase for functions and helpers
- async functions do not use a special prefix
- UI handlers commonly use inline callbacks or verbs like `getTask`, `getTasks`, `submit`

**Variables:**
- camelCase for local variables and state
- lower-case descriptive constants for local config values like `apiBaseUrl`, `registry`, `runtime`
- no underscore prefix convention in current code

**Types:**
- PascalCase for interfaces and type aliases
- Zod schema variables use lower camel plus `Schema` suffix

## Code Style

**Formatting:**
- Double quotes for strings
- Semicolons are required
- Trailing commas used where TS/JS formatter would normally add them
- Import lines are often kept compact until they become long enough to wrap

**Linting:**
- No lint task configured yet
- Type checking is the main enforced static quality gate

## Import Organization

**Order:**
1. External packages
2. Internal workspace packages
3. Relative imports

**Grouping:**
- Usually one blank line between broad groups
- Type imports are mixed into the same statement when convenient rather than separated rigorously

**Path Aliases:**
- None in source; workspace packages are imported by package name like `@agent-foundry/core`

## Error Handling

**Patterns:**
- Validate inputs at API boundaries with Zod
- Throw errors in runtime or registry code when invariants fail
- Catch expected route-level failures in Fastify handlers and translate them into HTTP error bodies

**Error Types:**
- Mostly plain `Error` instances with descriptive messages
- No custom error hierarchy yet

## Logging

**Framework:**
- Fastify built-in logger in the API
- No shared logger abstraction yet

**Patterns:**
- Logging happens mainly at server boundaries rather than deep in runtime internals
- Workbench UI uses user-facing string messages instead of logging

## Comments

**When to Comment:**
- Current code is mostly self-descriptive and uses very few comments
- Prefer comments only when explaining a policy or tricky edge

**JSDoc/TSDoc:**
- Not used in the current codebase

## Function Design

**Size:**
- Modules tend to keep helpers small and colocated
- `AgentRuntimeService` is the first larger orchestration module and is the pattern to watch when adding complexity

**Parameters:**
- Small positional parameter lists for services and helpers
- Object payloads used for route bodies and structured task data

**Return Values:**
- Explicit return values throughout
- Guard clauses used for missing task / failed HTTP cases

## Module Design

**Exports:**
- Named exports preferred in TypeScript packages
- Default exports reserved for Next.js page modules

**Barrel Files:**
- `packages/core/src/index.ts` re-exports package public APIs
- `packages/shared/src/index.ts` acts as the single contract barrel

---

*Convention analysis: 2026-03-22*
*Update when patterns change*
