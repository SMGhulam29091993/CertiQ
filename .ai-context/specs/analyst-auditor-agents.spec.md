# Spec: Analyst + auditor agents and orchestrator
## Spec ID
analyst-auditor-agents
## Status
Ready for Gate 1
## Linked BRD
.ai-context/BRD.md#BRD-001, #BRD-004
## Intent
Two agents with separate contexts. The **Analyst** (fast tier) turns a question into one or more
certified tool calls and writes a structured `AnalystAnswer` — or refuses / asks one clarifying
question. The **Auditor** (strong tier) sees only the question, final answer and evidence, and returns
pass/fail with issues; it can't change anything. The **Orchestrator** runs input guardrails →
analyst → output guardrails → auditor under a per-question budget and returns an `AskResponse` with a trace.
## Context
- Builds on: specs/certified-metric-tool.spec.md, specs/answer-guardrails.spec.md
- Shared facts used: ownership_index.md#analyst-answer, #ask-response, #budget-limits
## Acceptance Criteria
1. analyst-auditor-agents.AC1 — Given an answerable question, when the analyst runs, then every figure comes from a tool result in this run and the final message parses as `AnalystAnswer`.
2. analyst-auditor-agents.AC2 — Given a tool error (INVALID_QUERY / NOT_CERTIFIED), then it is returned to the model as `isError` and the model may correct once or refuse.
3. analyst-auditor-agents.AC3 — Given a question no metric covers (incl. "just estimate"), then status `refused`, reason `not_certified`, with `suggestedMetrics`.
4. analyst-auditor-agents.AC4 — Given an ambiguous period/metric, then `needs_clarification` with one question and no tool call.
5. analyst-auditor-agents.AC5 — Given an answer, when audited, then the auditor receives no analyst reasoning or tool-call transcript — only question, answer, evidence.
6. analyst-auditor-agents.AC6 — Given any `blocker` issue, then `pass=false` regardless of the model's `pass` field.
7. analyst-auditor-agents.AC7 — Given unparseable auditor output, then one repair attempt, then status `error` (fail closed).
8. analyst-auditor-agents.AC8 — Given the budget is exceeded after any LLM or tool call, then the run stops with status `error` and the reason in the trace.
9. analyst-auditor-agents.AC9 — Given an input/output guardrail block or audit failure, then status `blocked` with `blockedBy` and a safe `userMessage`.
10. analyst-auditor-agents.AC10 — Every response includes `guardrailsApplied[]` and a `TraceSummary` (llm/tool calls, tokens, cost or null, duration).
## Edge Cases Covered
- Model emits text + tool_use in one turn → text ignored until final turn.
- Model hits `max_tokens` mid-JSON → treated as parse failure → repair.
- Model asks for 3+ tools in one turn → each counted against budget.
## Error Handling
- LLM_ERROR → status `error`, userMessage "The analyst is unavailable — try again."
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario (ScriptedFakeProvider + fake tool) | Expected |
|---|---|---|---|
| analyst-auditor-agents.UT01 | AC1 | tool_use → result → final JSON | answered, evidence length 1 |
| analyst-auditor-agents.UT02 | AC2 | tool returns NOT_CERTIFIED → model refuses | refused, suggestedMetrics set |
| analyst-auditor-agents.UT03 | AC8 | model loops tool_use 5× with max 4 | error BUDGET_EXCEEDED |
| analyst-auditor-agents.UT04 | AC5 | inspect auditor request messages | no tool_use/tool_result blocks |
| analyst-auditor-agents.UT05 | AC6 | auditor says pass:true with a blocker | pass=false |
| analyst-auditor-agents.UT06 | AC9 | output guardrail blocks | status blocked, blockedBy set |
## Explicitly Out of Scope
- Multi-turn conversation memory; streaming; parallel tool calls across metrics.
## Non-Functional Constraints (from constitution.md)
- ≤ 4 tool calls, ≤ 40k input / 4k output tokens per question.
