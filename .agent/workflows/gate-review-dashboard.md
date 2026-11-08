# Gate Review Dashboard — scan procedure

Build fresh every time. Never reuse a previous scan.

1. List every file in `.ai-context/specs/*.spec.md` (each file *is* a spec, by construction).
2. For each spec, read its `Status` block and find its tasks in `.ai-context/tasks/<slug>.tasks.md`.
3. Sort into four buckets — never merged:
   - **Gate 1 pending** — DoR met, no `Reviewed by:` line.
   - **Gate 1 re-review needed** — `Reviewed by:` line carries `⚠️ SUPERSEDED`.
   - **Gate 2 pending** — all tasks `[x]`, no `Gate 2 reviewed by:` line for the slug in `state/completed.md`.
   - **Found, but not ready** — fails DoR; state *which* DoR item fails.
4. Render each entry with its full spec inline (Intent, ACs, Edge Cases, Error Handling, Out of Scope).
5. End with: total per bucket, and the single next recommended review.
