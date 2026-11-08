# Spec: Answer guardrails
## Spec ID
answer-guardrails
## Status
Ready for Gate 1
## Linked BRD
.ai-context/BRD.md#BRD-001, #BRD-002
## Intent
Deterministic checks at three stages — before the model sees a question, before it sees tool
results, and before a user sees an answer — so that privacy and correctness never depend on the
model behaving. Each guardrail is one class returning allow / transform / block; chains compose them.
## Context
- Shared facts used: ownership_index.md#guardrail-ids, #analyst-answer, #min-group-size
## Acceptance Criteria
1. answer-guardrails.AC1 — Given a question asking about a named/identified patient or personal identifiers, when input guardrails run, then it is blocked by `input.phi_request` before any LLM call.
2. answer-guardrails.AC2 — Given an obvious injection or raw SQL, then blocked by `input.prompt_injection`.
3. answer-guardrails.AC3 — Given an answered response, when `output.numeric_grounding` runs, then every `figures[].value` equals (rel. tol 0.5%) a non-suppressed evidence value for the same metric, or the sum of such values for a total.
4. answer-guardrails.AC4 — Given numbers written in `summary` prose ($1,234.56 / 12.3% / 1,234 / 12.3 h), then each matches a figure after unit formatting; otherwise blocked.
5. answer-guardrails.AC5 — Given a figure whose only match is a suppressed row, then blocked.
6. answer-guardrails.AC6 — Given a figure citing a metric@version absent from the run's evidence, then blocked by `output.citation`.
7. answer-guardrails.AC7 — Given rows with patientCount < k, then `tool_result.small_group_suppression` nulls them and counts `suppressedRows`.
## Edge Cases Covered
- Years and dates in prose ("2026", "Q3") are not treated as figures.
- Ratios: figure 0.123 ↔ prose "12.3%".
- Refused / needs_clarification answers skip numeric checks.
## Error Handling
- A guardrail never throws for expected input; a block carries an internal `reason` (logged) and a safe `userMessage` (shown).
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| answer-guardrails.UT01 | AC1 | 3 PHI phrasings | blocked by input.phi_request |
| answer-guardrails.UT02 | AC2 | ignore-instructions; SELECT * | blocked |
| answer-guardrails.UT03 | AC1,2 | 3 normal aggregate questions | allowed |
| answer-guardrails.UT04 | AC3 | figure 670138.48 vs evidence 670138.48 | allow |
| answer-guardrails.UT05 | AC4 | summary says "$700,000" not in figures | block |
| answer-guardrails.UT06 | AC7 | one row with 4 patients, k=10 | value null, suppressedRows 1 |
| answer-guardrails.UT07 | AC5 | figure equals a suppressed row's pre-suppression value | block |
| answer-guardrails.UT08 | AC6 | figure cites metric not in evidence | block by output.citation |
## Explicitly Out of Scope
- LLM-based topic classifier (scope handled by analyst refusal + evals).
## Non-Functional Constraints (from constitution.md)
- Guardrail Invariants 1, 2, 5.
