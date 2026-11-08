# Tasks: Eval harness
## Derived From
.ai-context/plans/eval-harness.plan.md
## Sequence
- [x] eval-harness.T01 — Golden schema, loader, `--validate-only`, 11 starter cases — Acceptance: AC1
- [ ] eval-harness.T02 — **LIVE** Runner (real container, injected `today`, k trials) — Acceptance: AC5
- [ ] eval-harness.T03 — **LIVE** Graders (status, numeric vs ground truth, suppression) + UT02, UT03 — Acceptance: AC2, AC3, AC4
- [ ] eval-harness.T04 — **LIVE** Report (pass@1, pass^3, per category, cost, p50/p95) — Acceptance: AC5
- [ ] eval-harness.T05 — **LIVE** Baseline gate + `--fast`; add `eval:fast` to Stop hook — Acceptance: AC6, AC7
