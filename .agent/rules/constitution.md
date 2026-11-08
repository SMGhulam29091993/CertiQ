# Project Constitution

## Testing Discipline
- **Framework:** Vitest (unit + integration), plus the golden-set eval harness in `packages/evals`.
- **Integration testing:** repository/tool tests run against the real seeded Postgres (`seed=42`),
  never a mocked client — a mocked datastore hides exactly the "number not backed by data" bug this
  product exists to prevent.
- **Test file location:** colocated `<name>.spec.ts` next to `<name>.ts`.
- **Coverage floor:** not yet defined — flag at Gate 1. (No invented number.)
- **Test-first scope (mandatory):** every guardrail; the query compiler; the metric tool; any API route.
- **Per-layer convention:** Repository → real DB. Service/agent → `ScriptedFakeProvider` + fake tool,
  no DB. Controller → real route, assert status + envelope shape only.
- **Regression rule:** a bug fix ships with a failing-first test **and** a golden case if the bug was
  an agent behaviour, plus an entry in `memory/pitfalls.md`.
- **Eval gate:** `pnpm eval` must not drop any `regression` case below `baseline.json`.
  Report pass@1 and pass^3 (3 trials) — consistency matters more than a lucky run.

## Security Posture
- **Never hardcode business payloads.** Every number in a response is traceable to a `MetricResult`
  from the certified tool in the same run.
- **No model-authored SQL.** The model emits a `MetricQuery` (ids only). SQL identifiers come from
  `metrics.yaml`; all values are bind parameters.
- **Least privilege:** the API uses `certiq_reader` — SELECT on `v_*` views only, read-only
  transactions, `statement_timeout`. Admin credentials are used only by the Prisma CLI and the seed.
- **Raw-unsafe boundary:** `$queryRawUnsafe` / `$executeRawUnsafe` only in
  `PrismaMetricRepository` and `seed.ts`; enforced by `certified-metric-tool.UT09` (ADR-0006).
  Everything else uses Prisma models or the tagged `$queryRaw` template.
- **No PHI.** Data is synthetic; no names, contacts or clinical notes exist. Individual-patient
  questions are blocked before any LLM call. Groups under `CERTIQ_MIN_GROUP_SIZE` (k=10) are suppressed
  before the model sees them.
- **Logging:** never log API keys, full prompts with user data, or raw rows; traces carry ids, counts,
  timings and costs only — including in `state/prompt_history.md`.
- **Dev-bypass guards:** none — CertiQ has no external integrations besides the LLM, and a missing
  `ANTHROPIC_API_KEY` must fail startup, never bypass.
- **Hardening backlog:**
  - `helmet()` — ✅
  - Rate limiter on `/ask` (20/min) — ✅
  - Body size limit (16kb) — ✅
  - Input length guardrail (500 chars) — ✅
  - Auth — ⬜ (out of scope, BRD-001)

## Guardrail Invariants (project-specific, non-negotiable)
1. Guardrails are deterministic code unless a spec says otherwise; an LLM may *add* a check, never
   *replace* a deterministic one.
2. The auditor can pass/fail; it can never rewrite an answer or a number.
3. The critic/auditor never sees the analyst's reasoning — only question, final answer, evidence.
4. Budget is checked after every LLM call and every tool call.
5. A suppressed value is never shown, inferred, or used to ground a number.

## Architectural Constraints
| Layer | Responsibility | Must NOT |
|---|---|---|
| Repository (`PrismaMetricRepository`) | Execute compiled SQL in a read-only txn | Validate, compile, or interpret results |
| Compiler (`SqlQueryCompiler`) | Registry-checked MetricQuery → SQL | Do I/O |
| Tool (`CertifiedMetricTool`) | validate → compile → execute → result guardrails | Know about LLMs or HTTP |
| Agents | Reason, call the tool, produce/judge answers | Touch registry, compiler or DB |
| Orchestrator | Route, gate, budget, trace | Edit answers |
| Controller | HTTP in/out | Contain decisions |

- **Dependency flow:** `Controller → IOrchestrator → IAnalystAgent/IAuditorAgent → IMetricTool → IQueryCompiler/IMetricRepository`.
  Only interfaces cross package boundaries; `@certiq/contracts` depends on nothing internal.
- **Composition root:** `apps/api/src/container.ts` is the only place concrete classes from other
  packages are instantiated.
- **Startup:** validate config → build container (registry integrity) → ping DB → listen; `exit(1)` on any failure.
- **Approved datastores:** PostgreSQL via Prisma 7 (`@prisma/adapter-pg`). No vector store (ADR-0001). New datastore ⇒ ADR.
- **Prisma client:** constructed only through `createPrismaClient(url)` in `@certiq/database`; the caller
  passes the URL so the role (admin vs reader) is always explicit at the call site.
- **Schema changes:** edit `schema.prisma` → `pnpm db:migrate:dev --name <change>` → commit the migration.
  Views, CHECKs, roles and grants go in a hand-written migration (`--create-only`), never applied ad hoc.
  `pnpm db:drift` must exit 0 before Gate 2.

## Non-Functional Baselines
- `/health` p95: not yet defined — flag at Gate 1.
- `/ask` p95: not yet defined — flag at Gate 1 (dominated by LLM latency; measure in evals first).
- Per-question budget: ≤ 4 tool calls, ≤ 40k input tokens, ≤ 4k output tokens (config, enforced).
- Cost per question: reported, never estimated — `null` until prices are configured.

## Versioning Rules
- Prisma packages are pinned to an exact version (currently 7.10.1); upgrades get an ADR.
- `metrics.yaml`: a change in a metric's meaning bumps that metric's `version` and `registry_version`
  (minor); adding a metric bumps minor; renaming/removing bumps major and needs an ADR.
- API: `openapi.yaml` `info.version` bumps in the same PR as the contract change.
