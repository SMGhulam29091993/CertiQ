# Plan: Certified metric tool
## Derived From
.ai-context/specs/certified-metric-tool.spec.md
## Architecture Approach
`CertifiedMetricTool implements IMetricTool` receives `IMetricRegistry`, `IQueryCompiler`,
`IMetricRepository`, `IGuardrailChain<MetricResult>` by constructor. `SqlQueryCompiler` is pure;
`PrismaMetricRepository` is I/O only. JSON Schema for the tool is generated from the registry so
enums never drift from `metrics.yaml`.
## Data Model
Prisma (ADR-0006). `schema.prisma`: 4 models + 2 enums. Migration `init` creates them; hand-written
migration `certified_views_and_reader_role` adds CHECKs, 4 `v_*` views (each with `patient_id`, enums
cast to text) and `certiq_reader` (SELECT on views only, read-only default, 5s timeout).
Seed: pure `generateDataset()` + Prisma `createMany` writer.
## Constitution Check
- [x] No new datastore (Postgres, via Prisma per team standard — ADR-0006)
- [x] Repository tests against real seeded DB (IT01–IT04)
- [x] No model-authored SQL; values bound; unsafe call sites fenced (UT09)
## Explicitly Deferred
- Query caching; multi-metric joins; derived metrics.
## Sequencing
1. Schema + role + seed → 2. Compiler + tests → 3. Repository → 4. Tool → 5. Ground-truth CLI → 6. Move data layer to Prisma
