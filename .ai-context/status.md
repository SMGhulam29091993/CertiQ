# Project Status Board
_Last updated: 2026-11-08_

## Active Specs
| Spec ID | Title | Status | Owner | Last Updated | Notes |
|---|---|---|---|---|---|
| metric-registry | Certified metric registry | Gate 1 approved · implemented | S M Ghulam Ghaus Faiyaz | 2026-11-10 | Pre-built ahead of Gate 1 (deviation logged) |
| certified-metric-tool | Certified metric tool | Gate 1 approved · implemented | S M Ghulam Ghaus Faiyaz | 2026-11-10 | On Prisma 7 (ADR-0006); verified on seeded DB; `db:drift` to run locally |
| answer-guardrails | Answer guardrails | Gate 1 approved · 3/4 tasks | S M Ghulam Ghaus Faiyaz | 2026-11-10 | T04 numeric grounding is live build |
| analyst-auditor-agents | Agents + orchestrator | Gate 1 approved · 1/5 tasks | S M Ghulam Ghaus Faiyaz | 2026-11-10 | T01–T04 live build |
| eval-harness | Eval harness | Gate 1 approved · 1/5 tasks | S M Ghulam Ghaus Faiyaz | 2026-11-10 | T02–T05 live build |
| ask-console | API + web console | Gate 1 approved · 3/4 tasks | S M Ghulam Ghaus Faiyaz | 2026-11-10 | `/ask` returns 501 naming the next task |

## Daily Execution Log
### 2026-11-08
- All six specs written; pre-build tasks implemented and verified (typecheck, 17 unit tests, golden validation, seeded-DB ground truth, read-only role checks, API boot, Next build).
- Decisions: ADR-0001…0005.
- Data layer moved to Prisma 7.10.1 (certified-metric-tool.T06, ADR-0006 supersedes ADR-0003). Same seed counts and identical ground-truth numbers; +7 tests (24 total).
