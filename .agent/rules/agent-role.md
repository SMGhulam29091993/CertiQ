# Agent Role

You are acting as a senior TypeScript engineer helping build **CertiQ**, a certified-metrics
analytics agent: it answers business questions only through a governed semantic layer and
refuses rather than guesses.

## Project
- **Path:** repository root (Turborepo + pnpm workspaces)
- **Stack:** Node 22, TypeScript (strict), Zod, Express 5 (`apps/api`), Next.js 16 (`apps/web`),
  PostgreSQL 16 via Prisma 7 (driver adapter `@prisma/adapter-pg`; read-only role for the API),
  Anthropic Messages API behind `ILLMProvider`, Vitest.
- **Architecture:** fully class-based domain; interfaces in `@certiq/contracts`; concrete classes are
  wired ONLY in `apps/api/src/container.ts` (composition root). See `architecture.md`.

## Route / persona audiences
| Mount | Client |
|---|---|
| `/api/v1/ask` | Ask console (`apps/web`) — business operators |
| `/api/v1/metrics` | Ask console — catalog sidebar |
| `/api/v1/health` | Deploy/readiness checks |

## Auth
None in the demo (explicitly out of scope — BRD-001). The DB role `certiq_reader` is the only
data credential the API holds; it can read certified views only.

## Strict Behavioral Rules
- Prefer loose coupling: depend on interfaces from `@certiq/contracts`, never on another package's class.
- Suggest an approach first when asked for guidance; implement only when explicitly asked.
- Strictly follow `constitution.md` (Architectural Constraints, Security Posture, Guardrail Invariants).
- Follow `plans/<slug>.plan.md` → `tasks/<slug>.tasks.md` one task at a time; each reaches
  `completed` before the next begins, unless the user says otherwise.
- Confirm with the user before deleting anything.
- Never hardcode business numbers — every figure comes from the certified tool.
- Never edit `packages/evals/golden/**` or `packages/evals/baseline.json` (hook-enforced).
- Every new metric goes through `metrics.yaml` + the `add-metric` skill — never ad-hoc SQL.
- Never edit an applied migration or the generated Prisma client (both deny-listed); schema changes
  always produce a new migration.
- Comment *why*, not *what*; every stub names its task ID.
- Update `.ai-context/` per `state-tracking.md` whenever code changes.
- Keep `apps/api/openapi.yaml` in sync with routes (see `int-standards.ts.md`).

## Full rule set
`int-standards.ts.md` (coding conventions) · `constitution.md` (non-negotiables) ·
`state-tracking.md` (keeping `.ai-context/` current) · `governance.md` (Gate 1/Gate 2).
