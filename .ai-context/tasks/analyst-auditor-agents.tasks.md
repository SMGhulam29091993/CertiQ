# Tasks: Analyst + auditor agents and orchestrator
## Derived From
.ai-context/plans/analyst-auditor-agents.plan.md
## Sequence
- [x] analyst-auditor-agents.T00 — Runtime: `TokenBudget`, `InMemoryTracer`, `RunContextFactory`; stubs with task ids — Acceptance: AC8, AC10 (support)
- [x] analyst-auditor-agents.T01 — **LIVE** Finalise analyst + auditor prompts (output schema, 1 answered + 1 refused example; 2 auditor calibration examples) — Acceptance: AC1, AC3, AC4, AC6
- [x] analyst-auditor-agents.T02 — **LIVE** `AnalystAgent` loop + UT01–UT03 — Acceptance: AC1, AC2, AC3, AC4, AC8
- [x] analyst-auditor-agents.T03 — **LIVE** `AuditorAgent` + UT04, UT05 — Acceptance: AC5, AC6, AC7
- [x] analyst-auditor-agents.T04 — **LIVE** `Orchestrator` + UT06 — Acceptance: AC8, AC9, AC10
