# Project Status Board
_Last updated: 2026-11-10_

## Active Specs
| Spec ID | Title | Status | Owner | Last Updated | Notes |
|---|---|---|---|---|---|
| metric-registry | Certified metric registry | Gate 1 approved · implemented | S M Ghulam Ghaus Faiyaz | 2026-11-10 | Pre-built ahead of Gate 1 (deviation logged) |
| certified-metric-tool | Certified metric tool | Gate 1 approved · implemented | S M Ghulam Ghaus Faiyaz | 2026-11-10 | On Prisma 7 (ADR-0006); verified on seeded DB; `db:drift` to run locally |
| answer-guardrails | Answer guardrails | Gate 1 approved · 4/4 tasks | S M Ghulam Ghaus Faiyaz | 2026-11-10 | T04 done; Gate 2 pending |
| analyst-auditor-agents | Agents + orchestrator | Gate 1 approved · 5/5 tasks | S M Ghulam Ghaus Faiyaz | 2026-11-10 | T01–T04 done (fake-provider tests); no live-LLM run yet; Gate 2 pending |
| eval-harness | Eval harness | Gate 1 approved · 5/5 tasks | S M Ghulam Ghaus Faiyaz | 2026-11-10 | T02–T05 done (subagent B); no live eval run yet; baseline empty; Gate 2 pending |
| ask-console | API + web console | Gate 1 approved · 3/4 tasks | S M Ghulam Ghaus Faiyaz | 2026-11-10 | `/ask` returns 501 naming the next task |

## Daily Execution Log
### 2026-11-08
- All six specs written; pre-build tasks implemented and verified (typecheck, 17 unit tests, golden validation, seeded-DB ground truth, read-only role checks, API boot, Next build).
- Decisions: ADR-0001…0005.
- Data layer moved to Prisma 7.10.1 (certified-metric-tool.T06, ADR-0006 supersedes ADR-0003). Same seed counts and identical ground-truth numbers; +7 tests (24 total).
### 2026-11-10
- Gate 1 approved for all six specs.
- Built analyst-auditor-agents.T01–T04, answer-guardrails.T04 (subagent A), eval-harness.T02–T05 (subagent B). Typecheck green (uncached); 85 unit tests green; golden set validates. No live-LLM or eval run yet. Stop-hook `eval:fast` step is opt-in (`CERTIQ_EVAL_ON_STOP=1`) pending owner decision.
