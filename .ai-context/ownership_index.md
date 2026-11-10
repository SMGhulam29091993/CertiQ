# Ownership Index
Any fact referenced by more than one file has exactly one canonical owner. Everything else links here.

## metric-definition
**Canonical definition:** `packages/semantic-layer/metrics.yaml` (shape: `packages/contracts/src/metric.ts › MetricDefinitionSchema`)
**Referenced by:** specs/metric-registry, specs/certified-metric-tool, specs/eval-harness, apps/web catalog panel
**Last updated:** 2026-11-08

## database-schema
**Canonical definition:** `packages/database/prisma/schema.prisma` (tables, enums, indexes) +
`packages/database/prisma/migrations/20261108000100_certified_views_and_reader_role/migration.sql`
(certified views, CHECKs, `certiq_reader` grants)
**Referenced by:** metrics.yaml (`source`, `time_column`, dimension `column`), specs/certified-metric-tool, architecture.md
**Last updated:** 2026-11-08

## seed-dataset
**Canonical definition:** `packages/database/src/dataset.ts › generateDataset` (seed=42)
**Referenced by:** golden suppression case, architecture.md row counts, dataset.spec.ts (UT07)
**Last updated:** 2026-11-08

## metric-query
**Canonical definition:** `packages/contracts/src/query.ts › MetricQuerySchema`
**Referenced by:** specs/certified-metric-tool, specs/analyst-auditor-agents, specs/eval-harness (golden `expect.query`)
**Last updated:** 2026-11-08

## analyst-answer
**Canonical definition:** `packages/contracts/src/agent.ts › AnalystAnswerSchema`
**Referenced by:** specs/analyst-auditor-agents, specs/answer-guardrails, specs/ask-console
**Last updated:** 2026-11-08

## ask-response
**Canonical definition:** `packages/contracts/src/agent.ts › AskResponse`
**Referenced by:** specs/ask-console, apps/api/openapi.yaml, apps/web
**Last updated:** 2026-11-08

## trace-step
**Canonical definition:** `packages/contracts/src/observability.ts › TraceStep` (in `TraceSummary.steps`); guardrail timing in `guardrail.ts › GuardrailStepRecord`
**Referenced by:** packages/agents (InMemoryTracer, Orchestrator), packages/guardrails (GuardrailChain), apps/web (answer-card ExecutionTrace)
**Last updated:** 2026-11-10

## min-group-size (k)
**Canonical definition:** `.env` `CERTIQ_MIN_GROUP_SIZE` (default 10 in `apps/api/src/config.ts`)
**Referenced by:** specs/answer-guardrails, constitution.md, golden/suppression-tickets-small-cells
**Last updated:** 2026-11-08

## budget-limits
**Canonical definition:** `apps/api/src/config.ts` (env `CERTIQ_MAX_*`)
**Referenced by:** specs/analyst-auditor-agents, constitution.md › Non-Functional Baselines
**Last updated:** 2026-11-08

## guardrail-ids
**Canonical definition:** each guardrail class's `readonly id` in `packages/guardrails/src/**`
**Referenced by:** specs/answer-guardrails, golden cases (`blocked_by`), web chips
**Last updated:** 2026-11-08
