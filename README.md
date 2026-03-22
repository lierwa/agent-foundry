# Agent Foundry

An implementation scaffold for a general-purpose agent platform built around LangGraph OSS, Fastify, Next.js, Postgres/Redis-backed runtime storage, structured schemas, human approvals, and reusable agent packages.

## Stack

- TypeScript monorepo
- LangGraph OSS for task orchestration
- Fastify platform API
- Next.js workbench
- Zod contracts
- In-memory or durable Postgres/Redis runtime storage selected through explicit env configuration
- Docker engine agnostic workflow: works with Docker Desktop or Colima

## Packages

- `apps/api`: task runtime and HTTP API
- `apps/workbench`: lightweight operator UI
- `packages/shared`: schemas and cross-app contracts
- `packages/core`: runtime orchestration, package registry, providers, memory abstractions

## Quick start

1. Make sure your shell resolves to Node `20.20.1` or newer.

```bash
source ~/.zshrc
node -v
npm -v
```

The repo scripts also auto-load `~/.zshrc` via `scripts/with-node20.sh`, so `npm run dev:api` and `npm run dev:web` will refuse to run on Node 16 and will prefer the user-local Node 20 install when available.

2. Run the local environment doctor:

```bash
npm run doctor
```

3. Install dependencies:

```bash
source ~/.zshrc
npm_config_cache=.npm-cache npm install
```

4. Choose a runtime mode:

In-memory mode is the default and needs no extra services:

```bash
export AGENT_FOUNDRY_STORE_MODE=in-memory
```

Durable mode uses the same API but persists task state in Postgres and memory records in Redis:

```bash
cp apps/api/.env.example apps/api/.env
export AGENT_FOUNDRY_STORE_MODE=durable
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/agent_foundry
export REDIS_URL=redis://localhost:6379
npm run docker:up
```

If you are unsure whether your machine is ready for durable mode, run `npm run doctor` again after exporting the variables above.

5. Start the API:

```bash
source ~/.zshrc
npm run dev:api
```

6. Start the workbench in a separate terminal:

```bash
source ~/.zshrc
npm run dev:web
```

By default, the API listens on `http://localhost:4000` and the workbench on `http://localhost:3000`.

## Verification

Run the Phase 1 verification baseline from the repo root:

```bash
npm run test
```

This executes the Vitest workspace suite, including runtime lifecycle coverage in `packages/core` and Fastify injection tests in `apps/api`.

## Docker runtime options

This repo is designed to run against any local Docker engine:

- `Docker Desktop` on newer machines
- `Colima + Docker CLI` on the older Intel Mac

### Option A: Docker Desktop

Start Docker Desktop, then run:

```bash
source ~/.zshrc
cd /Users/junxi/Desktop/work/agent-foundry
npm run docker:up
```

### Option B: Colima

Install `docker` and `colima`, then start the VM:

```bash
colima start --cpu 4 --memory 6 --disk 40
docker context use colima
docker info
```

Then run:

```bash
source ~/.zshrc
cd /Users/junxi/Desktop/work/agent-foundry
npm run docker:up
```

Stop services:

```bash
npm run docker:down
```

## Current shape

- Planner -> Executor -> Reviewer -> Finalizer task flow
- Node-level approvals at planner and executor stages
- Structured and semantic memory stubs with in-memory adapters
- Knowledge provider abstraction with a perfume package example
- Full trace capture for planning, tool/knowledge usage, approvals, and result validation

## Runtime configuration

The runtime bootstrap reads these exact variables:

- `AGENT_FOUNDRY_STORE_MODE=in-memory|durable`
- `DATABASE_URL=postgres://postgres:postgres@localhost:5432/agent_foundry`
- `REDIS_URL=redis://localhost:6379`

When `AGENT_FOUNDRY_STORE_MODE=in-memory`, the API uses the in-memory adapters and ignores the durable URLs.
When `AGENT_FOUNDRY_STORE_MODE=durable`, both `DATABASE_URL` and `REDIS_URL` must be set.

## GSD workflow

This repo now includes a local GSD-for-Codex install in `.codex/` and a brownfield project bootstrap in `.planning/`.

Useful starting points:

```text
$gsd-progress
$gsd-discuss-phase 1
$gsd-plan-phase 1
```

This repo is already initialized as a local git repository for the GSD execution flow, so phase execution commands can use commit checkpoints directly.

## Local machine preparation

Your shell should contain this block in `~/.zshrc` so the user-local Node 20 install wins over the old Homebrew Node 16:

```bash
export AGENT_FOUNDRY_NODE_HOME="$HOME/.local/node-v20.20.1-darwin-x64"
if [ -d "$AGENT_FOUNDRY_NODE_HOME/bin" ]; then
  case ":$PATH:" in
    *":$AGENT_FOUNDRY_NODE_HOME/bin:"*) ;;
    *) export PATH="$AGENT_FOUNDRY_NODE_HOME/bin:$PATH" ;;
  esac
fi
```

After editing shell config, run:

```bash
source ~/.zshrc
hash -r
node -v
npm -v
```

Optional but recommended runtime services for the next phase:

- Postgres + pgvector
- Redis
- Docker Desktop if you want to use `infra/docker-compose.yml`

## Cross-machine rule

- On the Intel Mac: use `Colima + Docker CLI`
- On the Windows 11 machine or the M1 Mac: use `Docker Desktop`
- The project command stays the same on every machine:

```bash
npm run docker:up
```

The only thing that changes is which Docker engine is active underneath.
