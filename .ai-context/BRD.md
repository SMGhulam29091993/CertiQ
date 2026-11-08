# Business Requirements

> Context: a portfolio demo inspired by the "trusted analytics" brief in a telehealth AI-engineering
> role. Requirements are written as if for an internal analytics agent at a telehealth operator.

### BRD-001: Trusted answers to business metric questions
**Raised by:** Ops/marketing leads (persona)
**Business need:** Operators ask quick questions ("revenue by product last quarter?") and today either
wait for an analyst or get confident wrong numbers from a chatbot.
**Sponsor:** S M Ghulam Ghaus Faiyaz
**Priority:** P0 — demo deadline 2026-11-10
**Decided:** Answers come only from certified metric definitions; uncertified questions are refused
with the closest certified alternatives. No free-form SQL.
**Open at BRD stage:** Multi-metric derived answers (e.g. revenue per new patient) — deferred.
**Notes:** Out of scope: auth, multi-tenant, write actions, dashboards, forecasting.

### BRD-002: Patient privacy by construction
**Raised by:** Compliance (persona)
**Business need:** An analytics agent in a pharmacy business must never expose an individual patient
or a re-identifiable small group.
**Sponsor:** S M Ghulam Ghaus Faiyaz
**Priority:** P0
**Decided:** Individual-patient questions blocked pre-LLM; groups under k=10 patients suppressed
before the model sees results; reader role sees views only.
**Open at BRD stage:** Whether k should vary by metric sensitivity.
**Notes:** Demo uses synthetic data only; no PHI exists in the system.

### BRD-003: Measurable answer quality with regression protection
**Raised by:** Engineering lead (persona)
**Business need:** Prompt or model changes must not silently make answers worse.
**Sponsor:** S M Ghulam Ghaus Faiyaz
**Priority:** P0
**Decided:** Golden set with ground truth computed by the certified tool; pass@1 and pass^3; build
fails on any regression-case drop below baseline.
**Open at BRD stage:** LLM-graded rubric for summary quality — deferred.

### BRD-004: Cost and latency control
**Raised by:** Engineering lead (persona)
**Business need:** Agent runs must not loop or spend unbounded tokens.
**Sponsor:** S M Ghulam Ghaus Faiyaz
**Priority:** P1
**Decided:** Per-question budget on tool calls, tokens and (when prices are configured) dollars;
cheap model generates, stronger model judges.
**Open at BRD stage:** Latency SLO — not yet defined.

### BRD-005: Transparent answers
**Raised by:** Finance (persona)
**Business need:** People only trust a number they can trace.
**Sponsor:** S M Ghulam Ghaus Faiyaz
**Priority:** P1
**Decided:** Every answer shows metric id + version, result rows (with suppressed cells marked), the
parameterized SQL, guardrails applied, and run cost/latency.
