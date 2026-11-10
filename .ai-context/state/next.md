# next.md
## Queued
- Local Prisma check on the author's machine: `pnpm db:up && pnpm db:migrate && pnpm db:drift` (expect exit 0) — blocked on: none.
  Reason: migrations were written by hand and applied with psql in the build sandbox, where the Prisma
  schema engine couldn't be downloaded. If `db:drift` reports changes, run `pnpm db:migrate:dev --name align`
  and record it in `memory/pitfalls.md`.
- First live eval (human-run): `pnpm db:up && pnpm eval`, review it, then record the baseline with the
  human-only baseline script (root package.json) — blocked on: none. Until then the gate applies no regression check.
- Decide whether the Stop hook runs `eval:fast` by default (currently opt-in via `CERTIQ_EVAL_ON_STOP=1`) — blocked on: owner decision.
- eval-reviewer pass + Gate 2 for analyst-auditor-agents.T01–T04, answer-guardrails.T04, eval-harness.T02–T05 — blocked on: first live eval
- Spec gap to consider: total-minus-breakdown differencing can reveal a suppressed cell; no guardrail covers it.
- ask-console.T04 — end-to-end browser check — blocked on: none (needs DB + ANTHROPIC_API_KEY)
