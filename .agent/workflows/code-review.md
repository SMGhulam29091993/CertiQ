# Gate 2 — Code Review Checklist

Run against the diff for one task (`<slug>.T<NN>`). Every box must be checked or explicitly waived with a reason.

## Contract & architecture
- [ ] Depends only on interfaces from `@certiq/contracts` across package boundaries
- [ ] No `new` of another package's concrete class outside `apps/api/src/container.ts`
- [ ] Layer responsibilities respected (constitution.md table)
- [ ] Expected failures returned as `Result`, not thrown

## Guardrail invariants (constitution.md)
- [ ] No path lets a number reach the user without a `MetricResult` from this run
- [ ] No model-authored SQL; all values bound as parameters
- [ ] No new `$queryRawUnsafe`/`$executeRawUnsafe` call sites (UT09 green; allow-list unchanged or ADR'd)
- [ ] Schema change ⇒ committed migration + `pnpm db:drift` exits 0
- [ ] Budget checked after every LLM and tool call
- [ ] Auditor cannot modify the answer
- [ ] Suppressed values never shown, inferred or used for grounding

## Tests & evals
- [ ] Colocated spec covers every AC in the task
- [ ] `pnpm typecheck` and `pnpm test` green
- [ ] `pnpm eval` ≥ baseline on regression cases (or runner not yet built — note it)
- [ ] `golden/` and `baseline.json` unchanged by the agent (hook-enforced; verify in diff)

## Docs & state
- [ ] `openapi.yaml` updated if routes changed
- [ ] `metrics.yaml` versions bumped if meaning changed
- [ ] `state/*` and `status.md` updated; drift recorded in `memory/lessons.md`
- [ ] No scope creep into the plan's "Explicitly Deferred"
