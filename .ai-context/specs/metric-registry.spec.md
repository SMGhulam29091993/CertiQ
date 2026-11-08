# Spec: Certified metric registry
## Spec ID
metric-registry
## Status
Ready for Gate 1
## Linked BRD
.ai-context/BRD.md#BRD-001
## Intent
A versioned YAML catalog (`metrics.yaml`) defines every metric CertiQ may answer from: meaning,
owner, unit, source view, aggregation, time column, allowed dimensions and synonyms. It is loaded
once at startup, validated against a Zod schema and cross-checked for integrity; the API refuses to
boot if it is invalid. It is the single source of truth for "what a metric means".
## Context
- Builds on: architecture.md (Metric catalog)
- Shared facts used: ownership_index.md#metric-definition
## Acceptance Criteria
1. metric-registry.AC1 — Given a valid `metrics.yaml`, when the registry loads, then every metric and dimension is retrievable by id and `version()` returns `registry_version`.
2. metric-registry.AC2 — Given a metric referencing an unknown dimension, duplicate ids, or a non-snake_case identifier, when loading, then construction throws naming the problem.
3. metric-registry.AC3 — Given a term like "revenue" or "reorders", when `suggest()` is called, then the matching certified metrics are returned ranked by synonym/label overlap.
## Edge Cases Covered
- Empty or missing `synonyms` → defaults to `[]`.
- Term with only stop-words → `suggest()` returns `[]`.
## Error Handling
- Invalid file → boot fails with every Zod issue path listed.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| metric-registry.UT01 | AC1 | Load real metrics.yaml | ≥ 6 metrics; `gross_revenue_usd` unit usd |
| metric-registry.UT02 | AC2 | Metric with dimension `nope` | throws `unknown dimension "nope"` |
| metric-registry.UT03 | AC3 | `suggest('revenue')` | contains `gross_revenue_usd` |
## Explicitly Out of Scope
- Hot reload; UI for editing metrics; embedding-based retrieval (ADR-0001).
## Non-Functional Constraints (from constitution.md)
- Identifiers are trusted SQL fragments → code-reviewed; regex-validated at load.
