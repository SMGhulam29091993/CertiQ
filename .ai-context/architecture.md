# Architecture

_Current truth, present tense. The "why" lives in `decisions/`._

## Packages
| Package | Owns | Depends on (internal) | Status |
|---|---|---|---|
| `@certiq/contracts` | Interfaces, Zod schemas, `Result` | — | ✅ built |
| `@certiq/database` | `schema.prisma`, migrations (tables + certified views + read-only role), `createPrismaClient()`, deterministic dataset + Prisma seed | — | ✅ built |
| `@certiq/semantic-layer` | `metrics.yaml`, registry, SQL compiler, `PrismaMetricRepository`, `CertifiedMetricTool` | contracts, database | ✅ built |
| `@certiq/guardrails` | Guardrail classes + `GuardrailChain` | contracts | 🟡 numeric grounding pending |
| `@certiq/llm` | `AnthropicProvider`, `ScriptedFakeProvider` | contracts | ✅ built |
| `@certiq/agents` | Analyst, Auditor, Orchestrator, budget, tracer | contracts | 🟡 runtime built; agents pending |
| `@certiq/evals` | Golden cases, loader, ground-truth CLI | contracts, semantic-layer, guardrails | 🟡 runner/graders pending |
| `@certiq/api` | HTTP edge + composition root | all of the above | ✅ built (501s until agents land) |
| `@certiq/web` | Ask console | contracts (types only) | ✅ built |

## Request flow
```
POST /api/v1/ask
  → Orchestrator.ask(question)                         [new RunContext: tracer + budget]
     → input GuardrailChain: max_length → phi_request → prompt_injection     (deterministic)
     → AnalystAgent (tier fast) ⇄ CertifiedMetricTool                        (≤ 4 tool calls)
          tool: Zod(MetricQuery) → SqlQueryCompiler(registry) → PrismaMetricRepository
                (certiq_reader · interactive txn · READ ONLY · statement_timeout · bound params)
                → tool_result GuardrailChain: small_group_suppression (k=10)
     → if refused / needs_clarification → return
     → output GuardrailChain: citation → numeric_grounding                  (deterministic)
     → AuditorAgent (tier strong, separate context) → pass | fail(blockers)
  → { status, answer, audit, evidence[], guardrailsApplied[], trace }
```

## Data
Synthetic only. Prisma 7.10.1 with `@prisma/adapter-pg`.
- `schema.prisma`: `Patient`, `Consultation`, `Order`, `SupportTicket`; enums `OrderStatus`, `ConsultOutcome`.
- Migrations: `20261108000000_init` (generated shape) → `20261108000100_certified_views_and_reader_role`
  (hand-written: CHECKs, `v_patients`, `v_orders`, `v_consultations`, `v_support_tickets`, `certiq_reader`).
- `certiq_reader` can SELECT the four views only (not base tables, not `_prisma_migrations`); read-only default; 5s timeout.
- Seed: `generateDataset()` is pure and deterministic (`seed=42`): 6,000 patients · 5,994 consultations ·
  17,518 orders · 1,434 tickets; `seed.ts` writes it with `createMany` on the admin connection.
- Raw-unsafe Prisma APIs are allowed only in `PrismaMetricRepository` and `seed.ts` (test-enforced).

## Metric catalog
Owned by `packages/semantic-layer/metrics.yaml` (registry v1.0.0, 9 metrics, 5 dimensions).

## Retrieval
None. The full catalog fits in the tool description. `IMetricRegistry.suggest()` (keyword overlap)
is the seam where retrieval over metric *definitions* would plug in at catalog scale (ADR-0001).
