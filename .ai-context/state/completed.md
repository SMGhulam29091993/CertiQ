# completed.md
## Finished
- metric-registry.T01–T04 — 2026-11-08 — Gate 2 reviewed by: (pending)
- certified-metric-tool.T01–T05 — 2026-11-08 — Gate 2 reviewed by: (pending)
- certified-metric-tool.T06 — 2026-11-08 — data layer moved to Prisma 7 (ADR-0006) — Gate 2 reviewed by: (pending)
- answer-guardrails.T01–T03 — 2026-11-08 — Gate 2 reviewed by: (pending)
- analyst-auditor-agents.T00 — 2026-11-08 — Gate 2 reviewed by: (pending)
- eval-harness.T01 — 2026-11-08 — Gate 2 reviewed by: (pending)
- ask-console.T01–T03 — 2026-11-08 — Gate 2 reviewed by: (pending)
- analyst-auditor-agents.T01–T04 — 2026-11-10 — Gate 2 reviewed by: (pending)
- answer-guardrails.T04 — 2026-11-10 — built by subagent A, reviewed by main agent — Gate 2 reviewed by: (pending)
- eval-harness.T03 — 2026-11-10 — built by subagent B, reviewed by main agent — Gate 2 reviewed by: (pending)
- eval-harness.T02, T04, T05 — 2026-11-10 — built by subagent B, reviewed by main agent; verified offline only (no live eval) — Gate 2 reviewed by: (pending)
- analyst-auditor-agents.T02 (revision) — 2026-11-10 — repair turn keeps tools; AC1 provenance check in the analyst; failure tests (tool TIMEOUT, invalid JSON twice, budget mid-turn, token budget). Fake-provider only, no live run — Gate 2 reviewed by: (pending)

## Recorded deviation
- 2026-11-08 — The tasks above were implemented before any spec passed Gate 1, to prepare the interview
  demo scaffold in one day. Not smoothed over: Gate 1 still runs on every spec, and if it changes a
  spec materially, the affected pre-built task reopens.
- 2026-11-10 — eval-harness.T03 was built before analyst-auditor-agents.T04 (next.md had it queued behind
  T04). Safe because the graders are pure functions over contract types; recorded, not smoothed over.
