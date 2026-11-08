# Tasks: Certified metric tool
## Derived From
.ai-context/plans/certified-metric-tool.plan.md
## Sequence
- [x] certified-metric-tool.T01 — Schema, certified views, `certiq_reader` role, deterministic seed — Acceptance: AC4
- [x] certified-metric-tool.T02 — `SqlQueryCompiler` + UT02–UT06 — Acceptance: AC1, AC2, AC3
- [x] certified-metric-tool.T03 — `PgMetricRepository` (read-only txn, timeout) — Acceptance: AC4
- [x] certified-metric-tool.T04 — `CertifiedMetricTool` + registry-generated JSON Schema — Acceptance: AC1–AC5
- [x] certified-metric-tool.T05 — `pnpm eval:truth` ground-truth CLI; IT01 verified via psql — Acceptance: AC4, AC5
