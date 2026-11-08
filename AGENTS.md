# CertiQ — agent entry point

If a Gate 1 or Gate 2 reviewer identifies themselves in this session, stop and
read `.agent/rules/governance.md` in full before doing anything else — it defines
the review process, and this file is not a substitute for it.

## Start of every session
1. Read `.ai-context/project_context.md` (the index), then `.agent/rules/agent-role.md`.
2. Read `.ai-context/state/current.md` and `next.md` — that is what we are doing now.
3. Work only from task IDs: `<slug>.T<NN>`, satisfying `<slug>.AC<N>`. Never re-describe a feature from memory.

## Commands
- `pnpm typecheck` · `pnpm test` · `pnpm eval:validate` · `pnpm eval:truth` · `pnpm eval` · `pnpm eval:fast`
- `pnpm db:up` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm dev`

## Where the rules live (do not restate them here)
`.agent/rules/` — agent-role · constitution · int-standards.ts · state-tracking · governance
