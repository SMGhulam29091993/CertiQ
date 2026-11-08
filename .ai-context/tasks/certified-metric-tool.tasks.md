# Tasks: Certified metric tool
## Derived From
.ai-context/plans/certified-metric-tool.plan.md
## Sequence
- [x] certified-metric-tool.T01 — Schema, certified views, `certiq_reader` role, deterministic seed (raw SQL; superseded by T06) — Acceptance: AC4
- [x] certified-metric-tool.T02 — `SqlQueryCompiler` + UT02–UT06 — Acceptance: AC1, AC2, AC3
- [x] certified-metric-tool.T03 — Repository with read-only txn + timeout (`pg`; superseded by T06) — Acceptance: AC4
- [x] certified-metric-tool.T04 — `CertifiedMetricTool` + registry-generated JSON Schema — Acceptance: AC1–AC5
- [x] certified-metric-tool.T05 — `pnpm eval:truth` ground-truth CLI — Acceptance: AC4, AC5
- [x] certified-metric-tool.T06 — Move data layer to Prisma 7 (ADR-0006): `schema.prisma`, two migrations, `createPrismaClient`, pure dataset + Prisma seed, `PrismaMetricRepository`, UT07–UT09, IT01–IT04 — Acceptance: AC4, AC6, AC7
