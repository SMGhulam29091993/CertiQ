# Governance

## Roles
- **Default author of record:** S M Ghulam Ghaus Faiyaz
- **Gate 1 reviewer:** S M Ghulam Ghaus Faiyaz (solo project — self-review, declared openly)
- **Gate 2 reviewer:** S M Ghulam Ghaus Faiyaz (solo project — self-review, declared openly), assisted
  by the read-only `eval-reviewer` subagent (`.claude/agents/eval-reviewer.md`)

> Solo-project adaptation (ADR-0004): the reviewer is the author. The gates still run, so the
> artefacts and checklists are exercised; independence is the thing this setup does not provide.

## Definition of Ready (before Gate 1)
- Intent fits in one paragraph a zero-context engineer/agent could build from.
- ACs are given/when/then, not adjectives.
- API Contract (if any), Edge Cases, Error Handling filled in.
- Out of scope named. Linked BRD entry exists.

## Definition of Done (before Gate 2 sign-off)
- Every item in `.agent/workflows/code-review.md` checked.
- `pnpm typecheck`, `pnpm test` green; `pnpm eval` ≥ baseline on all regression cases (once the runner exists).
- `status.md` and `state/*` match reality; new shared facts registered in `ownership_index.md`.
- Real drift/mistakes written to `memory/` before completion.
- `plan.md` "Explicitly Deferred" not crept into.
- Stable decisions promoted into `architecture.md`.
- `Gate 2 reviewed by: <name>, <date>, <verdict>` recorded in `state/completed.md`.

## Reviewer self-identification trigger
When a Gate 1 or Gate 2 reviewer identifies themselves:
1. Welcome them by name; confirm which gate.
2. Build the dashboard by following `.agent/workflows/gate-review-dashboard.md` exactly.
3. After the verdict, the agent (never the reviewer) records it in the spec's `Status` block
   (Gate 1) or `state/completed.md` (Gate 2).

## Re-review / supersede
Material spec change after Gate 1 ⇒ append `⚠️ SUPERSEDED <date>, needs Gate 1 re-review (<reason>)`.

## Staleness
`state/current.md` untouched for 5+ working days while commits land ⇒ flag before anything else.

## Archival
ADRs superseded > 3 months → `decisions/archive/`. `lessons.md`/`pitfalls.md` archived only when made
structurally impossible (a type, a hook, a golden case), noted inline.

## Reviewer permission boundary
Reviewers give a verdict + comment; the agent writes the file edits.

## Status
As of 2026-11-08: no gate has fired yet. All six specs are `Ready for Gate 1`; pre-built tasks were
implemented ahead of Gate 1 to prepare the demo (recorded as a deviation in `state/completed.md`, not
smoothed over). Nothing here has been exercised by a second person.
