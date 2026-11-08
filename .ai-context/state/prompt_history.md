# prompt_history.md
_Append-only. One entry per completed task. No secrets, no data rows._

### [2026-11-08] — pre-build (multiple slugs)
**User Request:** Scaffold the certified-metrics analyst demo as a Turborepo monorepo following the Hybrid SDD/AIPOS guide, with a Next.js frontend.
**Agent Action:** Created contracts, database, semantic-layer, guardrails, llm, agents (runtime + stubs), evals (loader + 11 golden cases + ground-truth CLI), api, web; `.agent/` rules and workflows; `.ai-context/` BRD, 6 specs/plans/tasks, ADR-0001…0005; Claude Code hooks, `eval-reviewer` subagent, `add-metric` skill. Verified typecheck, unit tests, golden validation, seeded-DB ground truth, read-only role, API boot, Next build.

### [2026-11-08] — certified-metric-tool.T06
**User Request:** Use Prisma for the data layer.
**Agent Action:** Added `schema.prisma`, `prisma.config.ts` (loads root .env), migrations `init` + `certified_views_and_reader_role`, `createPrismaClient`, pure `generateDataset` + Prisma seed, `PrismaMetricRepository`; removed raw-SQL schema, `migrate.ts`, `PgMetricRepository`, `pg` deps. ADR-0006 supersedes ADR-0003. New tests UT07–UT09, IT01–IT04. Verified on a fresh Postgres: migrations apply, seed counts unchanged, ground truth identical to the pre-Prisma run, all 24 tests green, API boots. Not verifiable in the sandbox: `prisma migrate deploy` / `db:drift` (schema-engine download blocked) — queued in next.md.
