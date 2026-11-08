# CertiQ — Monorepo Setup Guide (Turborepo × Hybrid SDD/AIPOS)

> How to stand up, run and extend CertiQ: a certified-metrics analytics agent built as a
> Turborepo + pnpm monorepo, governed by the Hybrid SDD/AIPOS system
> (`Hybrid_SDD_AIPOS_Setup_Guide.md`). Where this repo deviates from that guide, the reason is
> recorded in `.ai-context/decisions/ADR-0004-trimmed-sdd-for-solo-demo.md`.

---

## 1. What you are setting up

CertiQ answers business questions ("gross revenue by product line in Q3?") **only** from a
catalog of certified metrics. The model picks ids from the catalog; deterministic code builds
the SQL, runs it read-only, suppresses small groups, and checks every number in the answer
before a separate auditor model passes or fails it.

Three layers live in one repository:

| Layer | Folder | Purpose |
|---|---|---|
| Control plane | `.agent/` | **How** agents behave — rules and workflows |
| Knowledge base | `.ai-context/` | **What** agents must know — BRD, specs, plans, tasks, ADRs, state, memory |
| Code | `apps/`, `packages/` | Turborepo workspaces; one package per responsibility |
| Tool config | `CLAUDE.md`, `AGENTS.md`, `.claude/` | Entry tripwires, hooks, subagent, skill |

---

## 2. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | ≥ 22 | `node -v` |
| pnpm | 10.x | `corepack enable && pnpm -v` |
| Docker | any recent | `docker -v` (or a local Postgres 16 on port 5433) |
| Anthropic API key | — | needed only for the agent steps |
| Claude Code | latest | optional, for the hooks/subagent/skill |

---

## 3. Repository map

```
certiq/
├── CLAUDE.md · AGENTS.md            # byte-identical tripwire + session start order
├── SETUP_GUIDE.md · README.md
├── package.json                     # root scripts, turbo, pnpm.onlyBuiltDependencies
├── pnpm-workspace.yaml              # apps/*, packages/*
├── turbo.json                       # build · dev · typecheck · test · eval
├── tsconfig.base.json               # strict, Bundler resolution, verbatimModuleSyntax
├── docker-compose.yml               # postgres:16 on :5433
├── .env.example
│
├── .agent/
│   ├── rules/        agent-role · constitution · int-standards.ts · state-tracking · governance · .agentignore
│   └── workflows/    code-review · gate-review-dashboard · generate-plan
├── .ai-context/
│   ├── project_context.md · architecture.md · BRD.md · ownership_index.md · status.md
│   ├── specs/ plans/ tasks/        # one file each per slug (6 slugs)
│   ├── test_cases/_integration.md
│   ├── state/        current · completed · next · blockers · prompt_history
│   ├── memory/       lessons · pitfalls · patterns · review-findings
│   └── decisions/    ADR-0001 … ADR-0005, archive/
├── .claude/
│   ├── settings.json                # deny rules + hooks
│   ├── hooks/        protect-evals.sh · protect-evals-bash.sh · typecheck.sh · stop-checks.sh
│   ├── agents/eval-reviewer.md      # read-only skeptical reviewer
│   └── skills/add-metric/SKILL.md
│
├── apps/
│   ├── api/          Express 5 — config, container (composition root), modules ask|metrics|health, openapi.yaml
│   └── web/          Next.js 16 — ask console, answer card, catalog panel
└── packages/
    ├── contracts/        interfaces + Zod schemas ONLY (depends on nothing internal)
    ├── database/         schema.sql (views + read-only role), migrate, deterministic seed
    ├── semantic-layer/   metrics.yaml, registry, SQL compiler, PG repository, CertifiedMetricTool
    ├── guardrails/       chain + input / tool_result / output guardrails
    ├── llm/              AnthropicProvider, ScriptedFakeProvider
    ├── agents/           runtime (budget, tracer), Analyst, Auditor, Orchestrator, prompts/
    └── evals/            golden/*.yaml, loader, ground-truth CLI, baseline.json
```

### Dependency direction (enforced by `package.json`)
```
contracts  ←  semantic-layer, guardrails, llm, agents        (libraries know only interfaces)
           ←  evals  (+ semantic-layer, guardrails for ground truth)
           ←  api    (+ everything: it is the composition root)
           ←  web    (types only; talks to api over HTTP)
```
No library package imports another library's class. If you need one, you need an interface in
`contracts` instead.

### Pre-built vs live build
| Built and verified | Left for the recorded session (stubs name the task) |
|---|---|
| contracts, database, semantic-layer, llm | `analyst-auditor-agents.T01` prompts |
| guardrails: chain, length, PHI, injection, suppression, citation | `analyst-auditor-agents.T02` analyst loop |
| agents runtime: budget, tracer, run context | `analyst-auditor-agents.T03` auditor |
| evals: schema, loader, 11 cases, `eval:truth` | `answer-guardrails.T04` numeric grounding |
| api + web | `analyst-auditor-agents.T04` orchestrator |
| all SDD files, hooks, subagent, skill | `eval-harness.T02–T05` runner → gate |

---

## 4. Quick start (this repo)

```bash
# 1. Install
corepack enable
pnpm install                       # esbuild postinstall is allowed via pnpm.onlyBuiltDependencies

# 2. Environment
cp .env.example .env
#   set ANTHROPIC_API_KEY
#   optional: fill CERTIQ_PRICE_* from the current Anthropic pricing page (cost shows "n/a" until you do)

# 3. Database
pnpm db:up                         # docker compose: postgres:16 on localhost:5433
pnpm db:migrate                    # tables, certified views, certiq_reader role
pnpm db:seed                       # deterministic synthetic data (seed=42)

# 4. Verify (no API key needed)
pnpm typecheck
pnpm test
pnpm eval:validate
pnpm eval:truth

# 5. Run
pnpm dev                           # api :4000 + web :3000 via turbo
```

Open http://localhost:3000. Until the live-build tasks land, the catalog panel works and asking a
question returns a clear 501 naming the next task (`analyst-auditor-agents.T04`).

---

## 5. Building the same monorepo from scratch

Use this when you want to reproduce the structure in a new repo, or explain it on camera.

### 5.1 Workspace skeleton
```bash
mkdir certiq && cd certiq && git init
pnpm init
pnpm add -D -w turbo typescript tsx vitest @types/node
printf 'packages:\n  - "apps/*"\n  - "packages/*"\n' > pnpm-workspace.yaml
mkdir -p apps packages
```
Add to the root `package.json`:
```json
"packageManager": "pnpm@10.28.0",
"pnpm": { "onlyBuiltDependencies": ["esbuild", "sharp"] },
"scripts": { "dev": "turbo run dev", "typecheck": "turbo run typecheck", "test": "turbo run test" }
```
Create `turbo.json` with `build`, `dev` (`cache:false, persistent:true`), `typecheck`
(`dependsOn: ["^typecheck"]`), `test`, `eval` (`cache:false`). Create `tsconfig.base.json`
(strict, `moduleResolution: "Bundler"`, `verbatimModuleSyntax`, `noEmit`).

### 5.2 A "just-in-time" internal package (ADR-0005)
Every library package follows the same three files:
```jsonc
// packages/<name>/package.json
{
  "name": "@certiq/<name>",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },        // source, no build step
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "dependencies": { "@certiq/contracts": "workspace:*" }
}
```
```jsonc
// packages/<name>/tsconfig.json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```
```ts
// packages/<name>/src/index.ts — the package's public surface
```
Create them in dependency order: `contracts` → `database` → `semantic-layer` → `guardrails` →
`llm` → `agents` → `evals`.

### 5.3 Apps
```bash
# API
mkdir -p apps/api/src && cd apps/api
pnpm add express helmet cors express-rate-limit zod
pnpm add @certiq/contracts@workspace:* @certiq/semantic-layer@workspace:* \
         @certiq/guardrails@workspace:* @certiq/llm@workspace:* @certiq/agents@workspace:*
pnpm add -D @types/express @types/cors
# scripts: "dev": "tsx watch --env-file-if-exists=../../.env src/main.ts"

# Web
mkdir -p ../web && cd ../web
pnpm add next react react-dom && pnpm add -D @types/react @types/react-dom @certiq/contracts@workspace:*
# next.config.ts → transpilePackages: ['@certiq/contracts']; import contracts with `import type` only
```

### 5.4 Database
`docker-compose.yml` with `postgres:16-alpine` on `5433:5432`. `packages/database/sql/schema.sql`
creates base tables, `v_*` views, and the `certiq_reader` role with SELECT on views only and
`default_transaction_read_only = on`. `migrate.ts` and `seed.ts` use `DATABASE_ADMIN_URL`; the API
only ever sees `DATABASE_READONLY_URL`.

### 5.5 Lay down the SDD system (bootstrap order from the Hybrid guide §7)
1. Skeleton: `.agent/rules`, `.agent/workflows`, `.ai-context/{specs,plans,tasks,test_cases,memory,state,decisions/archive}`.
2. Rules in order: `agent-role.md` → `constitution.md` → `int-standards.ts.md` → `state-tracking.md` → `governance.md`.
3. `project_context.md` — pointers only.
4. `BRD.md` — before any spec.
5. Entry files: `CLAUDE.md` + `AGENTS.md`, byte-identical (`cmp CLAUDE.md AGENTS.md`).
6. Names in `governance.md`.
7. Empty `memory/*` and `ownership_index.md`.
8. Empty `state/*`.
9. First slug: spec → plan → tasks.
10. Process changes go in `governance.md` only.

---

## 6. Verification checklist

| Check | Command | Expected |
|---|---|---|
| All packages typecheck | `pnpm typecheck` | `Tasks: 9 successful` |
| Unit tests | `pnpm test` | guardrails 9 ✓ · semantic-layer 8 ✓ |
| Golden cases valid | `pnpm eval:validate` | `✔ 11 golden cases valid` |
| Seed counts | `pnpm db:seed` | 6000 patients · 5994 consultations · 17518 orders · 1434 tickets |
| Ground truth | `pnpm eval:truth` | 6 numeric cases ✔; suppression case `rows=10 suppressed=1` |
| Reader can't read base tables | `PGPASSWORD=certiq_reader psql -h localhost -p 5433 -U certiq_reader -d certiq -c "select 1 from orders"` | `permission denied for table orders` |
| Reader can't write | `… -c "create table x(a int)"` | `read-only transaction` |
| API boots | `pnpm --filter @certiq/api dev` | `✔ CertiQ API on :4000 — registry v1.0.0, 9 certified metrics` |
| Health | `curl localhost:4000/api/v1/health` | `{"success":true,…"db":"up"…}` |
| Ask (before live build) | `curl -XPOST localhost:4000/api/v1/ask -H 'content-type: application/json' -d '{"question":"revenue?"}'` | 501 naming `analyst-auditor-agents.T04` |
| Web builds | `pnpm --filter @certiq/web build` | static `/` route |
| Entry files identical | `cmp CLAUDE.md AGENTS.md` | no output |
| Hooks block golden edits | ask Claude Code to edit `packages/evals/golden/*.yaml` | blocked with protect-evals message |

---

## 7. Where the Hybrid SDD/AIPOS artefacts live here

| Guide artefact | In this repo | Note |
|---|---|---|
| `.agent/rules/*` (5 files) | ✅ all five | `int-standards.ts.md` for the TS stack |
| `.agent/workflows/*` | `code-review`, `gate-review-dashboard`, `generate-plan` | `generate-tests` dropped (ADR-0004) |
| Six thin entry files | `CLAUDE.md`, `AGENTS.md` | only the tools in use (ADR-0004) |
| `BRD.md` | BRD-001 … BRD-005 | |
| specs / plans / tasks | 6 slugs | `metric-registry`, `certified-metric-tool`, `answer-guardrails`, `analyst-auditor-agents`, `eval-harness`, `ask-console` |
| `test_cases/<slug>` | spec tables + `_integration.md` | spec table is canonical (ADR-0004) |
| `ownership_index.md` | 7 shared facts | metric definitions owned by `metrics.yaml` |
| `state/`, `memory/` | ✅ | real entries only — no backfill |
| `decisions/` | ADR-0001 … 0005 | ADR-0001 explains why no RAG |
| Gate 1 / Gate 2 | self-review, declared | + `eval-reviewer` subagent |
| (new) Claude Code hooks | `.claude/settings.json` | turn prose rules into enforced ones |

Test IDs in code match spec IDs (`it('certified-metric-tool.UT02 — …')`), so a failing test points
straight at its acceptance criterion.

---

## 8. Claude Code setup (show this on camera)

| File | What it enforces |
|---|---|
| `.claude/settings.json › permissions.deny` | Can't read `.env`; can't edit `golden/` or `baseline.json` |
| `hooks/protect-evals.sh` (PreToolUse Edit/Write) | Belt-and-braces block on golden/baseline edits with an explanation |
| `hooks/protect-evals-bash.sh` (PreToolUse Bash) | Closes the shell side-door (`sed -i`, `>`, `rm`, `eval:baseline`) |
| `hooks/typecheck.sh` (PostToolUse) | Typecheck after every `.ts/.tsx` edit; errors fed straight back |
| `hooks/stop-checks.sh` (Stop) | Can't declare "done" with failing tests or invalid golden cases |
| `agents/eval-reviewer.md` | Read-only skeptical reviewer for eval results and Gate 2 |
| `skills/add-metric/SKILL.md` | The only sanctioned way to add or change a metric |

Prose rules drift; hooks don't. That is the line to say out loud.

---

## 9. Running the live build

Prompt by task ID, never by description (Hybrid guide §3):

> Implement `analyst-auditor-agents.T02`. Satisfy AC1–AC4 and AC8 in
> `.ai-context/specs/analyst-auditor-agents.spec.md`. Depend only on `ILLMProvider` and
> `IMetricTool`. Write UT01–UT03 with `ScriptedFakeProvider`. Don't touch T03/T04.
> Plan first; wait for my go.

Suggested order (each step leaves the repo green):
1. Gate 1 self-review of the six specs → record verdicts in each `Status` block.
2. `analyst-auditor-agents.T01` prompts.
3. `analyst-auditor-agents.T02` analyst loop (fake-provider tests).
4. `answer-guardrails.T04` numeric grounding (deterministic, unit-tested).
5. `analyst-auditor-agents.T03` auditor.
6. `analyst-auditor-agents.T04` orchestrator → `/ask` goes live → check in browser (`ask-console.T04`).
7. `eval-harness.T02–T05` → `pnpm eval:baseline` (you, not the agent) → make a "harmless" prompt
   change → `pnpm eval` catches the regression → fix → green.
8. Gate 2 with `eval-reviewer`; record in `state/completed.md`; drift corrections into `memory/lessons.md`.

---

## 10. Recipes

**Add a metric** — run the `add-metric` skill. It edits `metrics.yaml`, bumps versions, runs tests
and `eval:truth`, and proposes a golden case for *you* to paste.

**Add a guardrail** — interface already exists. Create `packages/guardrails/src/<stage>/<name>.guardrail.ts`
implementing `IGuardrail<T>` with `id = '<stage>.<name>'`, export it, add a spec test, add it to the
right chain in `apps/api/src/container.ts`. No other file changes (Open/Closed).

**Swap the LLM vendor** — new class in `packages/llm` implementing `ILLMProvider`; change one line
in `container.ts`.

**Add a golden case** — write `packages/evals/golden/<id>.yaml` yourself, check it with
`pnpm eval:validate` and `pnpm eval:truth`, then re-record the baseline deliberately.

**Add a package** — §5.2 template, add it to the consumer's `dependencies` as `workspace:*`,
`pnpm install`, register it in `.ai-context/architecture.md`.

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `tsx`/`vitest` crash about esbuild | pnpm 10 blocked its postinstall | ensure `pnpm.onlyBuiltDependencies` includes `esbuild`, re-run `pnpm install` |
| API exits "Invalid configuration" | missing/invalid env | read the listed keys; copy `.env.example` |
| API exits "Database unreachable" | DB not up or wrong port | `pnpm db:up`; port is **5433** |
| `permission denied for view` | migrate not run after a reset | `pnpm db:migrate` (re-grants) |
| Cost shows "n/a" | prices not configured | fill `CERTIQ_PRICE_*` from the official pricing page |
| `/ask` returns 501 | live-build task not done yet | the message names the task |
| Next build complains about contracts | value import in web | use `import type` only |

---

## 12. Quick reference

| I want to… | Do |
|---|---|
| Orient a new agent session | `CLAUDE.md` → `.ai-context/project_context.md` → `.agent/rules/agent-role.md` |
| See what's next | `.ai-context/state/next.md` |
| Know why no RAG | `.ai-context/decisions/ADR-0001-no-rag-over-data.md` |
| See every number's ground truth | `pnpm eval:truth` |
| Change what a metric means | `add-metric` skill; never hand-edit SQL elsewhere |
| Change the review process | `.agent/rules/governance.md` only |
| Record an agent drift you corrected | `.ai-context/memory/lessons.md` with the rule/test that now prevents it |
