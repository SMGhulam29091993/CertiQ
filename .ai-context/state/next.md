# next.md
## Queued
- Local Prisma check on the author's machine: `pnpm db:up && pnpm db:migrate && pnpm db:drift` (expect exit 0) — blocked on: none.
  Reason: migrations were written by hand and applied with psql in the build sandbox, where the Prisma
  schema engine couldn't be downloaded. If `db:drift` reports changes, run `pnpm db:migrate:dev --name align`
  and record it in `memory/pitfalls.md`.
- Gate 1 self-review — all six specs — blocked on: none
- analyst-auditor-agents.T01 — prompts — blocked on: Gate 1
- analyst-auditor-agents.T02 — analyst loop — blocked on: T01
- analyst-auditor-agents.T03 — auditor — blocked on: T01
- answer-guardrails.T04 — numeric grounding — blocked on: Gate 1
- analyst-auditor-agents.T04 — orchestrator — blocked on: T02, T03, answer-guardrails.T04
- eval-harness.T02–T05 — runner, graders, report, gate — blocked on: analyst-auditor-agents.T04
- ask-console.T04 — end-to-end browser check — blocked on: analyst-auditor-agents.T04
