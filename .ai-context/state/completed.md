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
- analyst-auditor-agents.T03 (revision) — 2026-11-10 — repair turn echoes text only (no tool_use replayed into the auditor context); answer copied field-by-field so extra runtime fields can't leak; tests: UT04 across the repair turn, auditor rejection, pass:false w/o issues, exactly-one-repair, max_tokens repair, malformed severity, orchestrator end-to-end with the real AuditorAgent (blocked / error). Fake-provider only, no live run — Gate 2 reviewed by: (pending)
- analyst-auditor-agents.T04 (revision) — 2026-11-10 — per-step trace (`TraceSummary.steps`: name, kind, duration, LLM/tool calls, tokens, retries, status, detail) for every guardrail and agent that runs; console "Execution trace" list; auditor-blocked responses no longer include the failed `answer`. Fake-provider tests only; no live run, no browser check — Gate 2 reviewed by: (pending)

## Recorded deviation
- 2026-11-08 — The tasks above were implemented before any spec passed Gate 1, to prepare the interview
  demo scaffold in one day. Not smoothed over: Gate 1 still runs on every spec, and if it changes a
  spec materially, the affected pre-built task reopens.
- 2026-11-10 — eval-harness.T03 was built before analyst-auditor-agents.T04 (next.md had it queued behind
  T04). Safe because the graders are pure functions over contract types; recorded, not smoothed over.
- 2026-11-10 — analyst-auditor-agents.T04 revision added per-step trace records and the console
  "Execution trace" list on the owner's request. This goes beyond AC10's wording (run totals only) and
  ask-console's "trace line"; the specs were not edited. Owner to decide at Gate 2 whether it counts as
  a material spec change (governance › Re-review / supersede).
