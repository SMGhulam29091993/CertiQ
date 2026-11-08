# CertiQ

**Business answers from certified metrics only. If it isn't certified, it says so.**

CertiQ is a small multi-agent analytics system for a telehealth operator. An analyst agent turns a
question into calls to one typed tool; deterministic code builds read-only SQL from a versioned
metric catalog; guardrails block patient-level questions, suppress small groups and check every
number; a separate auditor model passes or fails the answer. A golden-set eval harness catches
regressions. Data is synthetic.

```
question → input guardrails → Analyst ⇄ certified metric tool → output guardrails → Auditor → answer + evidence + trace
```

- **No RAG over data, no model-written SQL** — see `.ai-context/decisions/ADR-0001-no-rag-over-data.md`.
- **Prisma 7** owns the schema, migrations, seed and client; metric queries are registry-built, parameterized SQL run in a read-only Prisma transaction — see ADR-0006.
- **SOLID / dependency inversion** — interfaces in `packages/contracts`; one composition root in `apps/api/src/container.ts`.
- **Spec-driven** — Hybrid SDD/AIPOS: `.agent/` (rules) + `.ai-context/` (BRD → specs → plans → tasks, ADRs, state, memory).

Setup, verification and the build order: **[SETUP_GUIDE.md](./SETUP_GUIDE.md)**.

```bash
pnpm install && cp .env.example .env && pnpm db:generate && pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm typecheck && pnpm test && pnpm eval:truth
pnpm dev   # api :4000 · web :3000
```
