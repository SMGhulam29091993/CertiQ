# State Tracking Rule

## On every completed task
1. Append to `.ai-context/state/prompt_history.md`:
   ```
   ### [YYYY-MM-DD HH:MM] — <slug>.T<NN>
   **User Request:** (one sentence)
   **Agent Action:** (files touched, decisions)
   ```
   Never log secrets, tokens or data rows.
2. Update `state/current.md`, `state/completed.md`, `state/next.md`. Skip only for read-only questions.

## Commit-status claims — verify, don't assert
Run `git status`/`git log` before writing any commit-status claim. Phrase so it ages safely.
`prompt_history.md` is append-only; old entries may age.

## Task lifecycle
- Mark `inprogress` before writing code; `completed` only when its ACs pass and typecheck is green.
- A deviation from task order is recorded, not smoothed over.

## Memory (`.ai-context/memory/`)
- `pitfalls.md` — non-obvious bug: symptom → root cause → fix.
- `lessons.md` — the approach was wrong.
- `patterns.md` — same approach in 2+ places.
- `review-findings.md` — real Gate 2 findings.
- **Agent-drift entries:** when the user corrects an agent's drift during a session (e.g. "merged
  analyst and auditor", "computed a ratio itself"), record it in `lessons.md` with the rule or
  golden case that now prevents it. Never backfill fabricated incidents.

## Decisions
New ADR only for a genuinely resolved ambiguity (tooling, data model, architecture) — not routine choices.
When stable, promote the outcome into `architecture.md` in present tense.

## Cross-reference
`governance.md` adds review-process triggers (staleness check, Gate 2 sign-off, archival).
