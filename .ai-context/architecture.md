# Architecture

_Current truth, present tense. The "why" lives in `decisions/`._

## Packages
| Package | Owns | Depends on (internal) | Status |
|---|---|---|---|
| `@certiq/contracts` | Interfaces, Zod schemas, `Result` | — | ✅ built |
| `@certiq/database` | Schema, certified views, read-only role, deterministic seed | — | ✅ built |
| `@certiq/semantic-layer` | `metrics.yaml`, registry, SQL compiler, PG repository, `CertifiedMetricTool` | contracts | ✅ built |
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
          tool: Zod(MetricQuery) → SqlQueryCompiler(registry) → PgMetricRepository(read-only)
                → tool_result GuardrailChain: small_group_suppression (k=10)
     → if refused / needs_clarification → return
     → output GuardrailChain: citation → numeric_grounding                  (deterministic)
     → AuditorAgent (tier strong, separate context) → pass | fail(blockers)
  → { status, answer, audit, evidence[], guardrailsApplied[], trace }
```

## Data
Synthetic only. Base tables: `patients`, `consultations`, `orders`, `support_tickets`.
Certified views (`v_patients`, `v_orders`, `v_consultations`, `v_support_tickets`) are the only
objects `certiq_reader` can read; each exposes `patient_id` for suppression counts.
Seed is deterministic (`seed=42`): 6,000 patients · 5,994 consultations · 17,518 orders · 1,434 tickets.

## Metric catalog
Owned by `packages/semantic-layer/metrics.yaml` (registry v1.0.0, 9 metrics, 5 dimensions).

## Retrieval
None. The full catalog fits in the tool description. `IMetricRegistry.suggest()` (keyword overlap)
is the seam where retrieval over metric *definitions* would plug in at catalog scale (ADR-0001).
