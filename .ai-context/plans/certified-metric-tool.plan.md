# Plan: Certified metric tool
## Derived From
.ai-context/specs/certified-metric-tool.spec.md
## Architecture Approach
`CertifiedMetricTool implements IMetricTool` receives `IMetricRegistry`, `IQueryCompiler`,
`IMetricRepository`, `IGuardrailChain<MetricResult>` by constructor. `SqlQueryCompiler` is pure;
`PgMetricRepository` is I/O only. JSON Schema for the tool is generated from the registry so
enums never drift from `metrics.yaml`.
## Data Model
`packages/database/sql/schema.sql`: 4 base tables, 4 `v_*` views (each with `patient_id`),
role `certiq_reader` (SELECT on views only, read-only default, 5s timeout). Deterministic seed.
## Constitution Check
- [x] No new datastore (Postgres)
- [x] Repository tests against real seeded DB (IT01 via `eval:truth` + psql checks)
- [x] No model-authored SQL; values bound
## Explicitly Deferred
- Query caching; multi-metric joins; derived metrics.
## Sequencing
1. Schema + role + seed → 2. Compiler + tests → 3. Repository → 4. Tool → 5. Ground-truth CLI
