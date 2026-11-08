# Spec: Eval harness
## Spec ID
eval-harness
## Status
Ready for Gate 1
## Linked BRD
.ai-context/BRD.md#BRD-003
## Intent
A golden set of questions, each with an expected status and — for numeric cases — the expected
certified `MetricQuery`. Ground truth is produced by running that query through the deterministic
tool, never typed by hand. The runner executes the real pipeline k times per case, grades each run,
reports pass@1 and pass^k per category with cost and latency, and fails the build if any
regression case falls below the committed baseline.
## Context
- Shared facts used: ownership_index.md#metric-query, #guardrail-ids
## Acceptance Criteria
1. eval-harness.AC1 — Given `golden/*.yaml`, when loaded, then every case validates (answered ⇒ has `expect.query`; blocked ⇒ has `blocked_by`); ids are unique.
2. eval-harness.AC2 — Given a numeric case, when graded, then each expected ground-truth row value must appear among the answer's figures within tolerance (or the expected total, for single-row results).
3. eval-harness.AC3 — Given a refusal/clarification/blocked case, then status (and `refusal_reason` / `blocked_by` when given) must match exactly.
4. eval-harness.AC4 — Given `must_mention_suppression`, then the summary must mention suppression/privacy and no figure may equal a suppressed row.
5. eval-harness.AC5 — Given `--trials 3` (default), then report pass@1 (any trial passed) and pass^3 (all passed) per case and per category, plus total tokens, cost and p50/p95 latency.
6. eval-harness.AC6 — Given a baseline, when any `regression` case's pass^3 drops below it, then exit code 1 and the case ids are printed.
7. eval-harness.AC7 — Given `--write-baseline`, then the current results are written to `baseline.json` (human-run only; agents are hook-blocked).
## Edge Cases Covered
- Seed changes don't invalidate cases (ground truth recomputed every run).
- A case whose ground-truth query errors is a harness failure, not an agent failure.
## Error Handling
- Missing DB/API key → exit 2 with a setup message (distinct from regression exit 1).
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| eval-harness.UT01 | AC1 | answered case without query | validation error |
| eval-harness.UT02 | AC2 | figures within 0.5% | pass |
| eval-harness.UT03 | AC4 | figure equals suppressed row | fail |
| eval-harness.UT04 | AC6 | regression case 3/3 → 2/3 vs baseline 3/3 | exit 1 |
## Explicitly Out of Scope
- LLM-graded summary rubric (deferred, BRD-003); CI pipeline config.
## Non-Functional Constraints (from constitution.md)
- `--fast` (regression only, 1 trial) for the Stop hook.
