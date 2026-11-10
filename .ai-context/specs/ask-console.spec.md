# Spec: Ask console (API + web)
## Spec ID
ask-console
## Status
Gate 1 approved — reviewed by: S M Ghulam Ghaus Faiyaz (solo self-review, ADR-0004), 2026-11-10, verdict: approve, no changes
## Linked BRD
.ai-context/BRD.md#BRD-005
## Intent
An Express API exposes ask / catalog / health; a Next.js page lets an operator ask a question and
see the answer card: status, audit badge, figures, summary, suggested metrics or blocking guardrail,
and an expandable "how this was computed" panel with rows (suppressed cells marked), SQL and params,
plus guardrail chips and a trace line (calls, tokens, cost, time).
## Context
- Shared facts used: ownership_index.md#ask-response
## API Contract
### ask-console.API01 — POST /api/v1/ask
**Request:** `{ "question": "string (1–2000)" }`
**Success (200):** `{ success: true, message, data: AskResponse }` — blocked/refused are 200s.
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | body fails validation | `{ success:false, message:"Validation failed", data: issues }` |
| 429 | > 20 req/min | rate-limit message |
| 501 | pipeline step not built | `{ success:false, message:"Not implemented yet — see <task>" }` |
| 500 | unhandled | `{ success:false, message:"Internal error" }` |
### ask-console.API02 — GET /api/v1/metrics → catalog (definitions only)
### ask-console.API03 — GET /api/v1/health → 200 `{db:"up"}` | 503
## Acceptance Criteria
1. ask-console.AC1 — Given invalid config or unreachable DB, when the API starts, then it exits non-zero before listening.
2. ask-console.AC2 — Given any route, then the response uses the `{success,message,data}` envelope and is documented in `openapi.yaml`.
3. ask-console.AC3 — Given an AskResponse, when rendered, then status, figures (unit-formatted), evidence SQL/params and guardrail chips are visible; suppressed cells read "Suppressed".
4. ask-console.AC4 — Given the API is down, then the catalog panel says so and asking shows an error card — no blank screen.
## Edge Cases Covered
- Mobile width (single column), dark mode, ⌘/Ctrl+Enter submit, long SQL scrolls horizontally.
## Error Handling
- Web never shows raw stack traces; uses `message` from the envelope.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| ask-console.UT01 | AC2 | POST /ask with `{}` | 400 envelope |
| ask-console.UT02 | AC2 | GET /health with DB up | 200 `{db:"up"}` |
## Explicitly Out of Scope
- Auth, history, sharing, charts.
## Non-Functional Constraints (from constitution.md)
- helmet, CORS to web origin, 16kb body limit, rate limit.
