# Spec: Certified metric tool
## Spec ID
certified-metric-tool
## Status
Gate 1 approved — reviewed by: S M Ghulam Ghaus Faiyaz (solo self-review, ADR-0004), 2026-11-10, verdict: approve, no changes
## Linked BRD
.ai-context/BRD.md#BRD-001, #BRD-002
## Intent
`query_certified_metric` is the only way an agent can obtain a number. It accepts a `MetricQuery`
(ids, filters, grain, time range — never SQL), validates it, compiles it against the registry into
parameterized SQL, executes it with the read-only role under a timeout, applies tool-result
guardrails (small-group suppression), and returns a `MetricResult` including the SQL and params for
display.
## Context
- Builds on: specs/metric-registry.spec.md
- Shared facts used: ownership_index.md#metric-query, #min-group-size
## API Contract
### certified-metric-tool.API01 — tool `query_certified_metric` (LLM tool, not HTTP)
**Input:** `MetricQuery` (see contracts/query.ts). JSON Schema generated from the registry with `enum`s for metric and dimension ids.
**Success:** `MetricResult { metricId, metricVersion, registryVersion, unit, query, rows[], suppressedRows, sql, params, executedAt, durationMs }`
**Exceptions:**
| Code | Condition | Returned to model as |
|---|---|---|
| INVALID_QUERY | Zod failure, disallowed dimension, unknown filter value, duplicate dims | tool_result isError with issues |
| NOT_CERTIFIED | metric id not in registry | isError + `suggestions[]` |
| TIMEOUT | statement_timeout hit (pg 57014) | isError |
| DB_ERROR | any other DB failure | isError (no internals) |
## Acceptance Criteria
1. certified-metric-tool.AC1 — Given a valid query, when run, then SQL contains no user-supplied value and all values are bind params.
2. certified-metric-tool.AC2 — Given an uncertified metric, then `NOT_CERTIFIED` with up to 3 suggestions.
3. certified-metric-tool.AC3 — Given a dimension or filter value not allowed for the metric, then `INVALID_QUERY` listing what is allowed.
4. certified-metric-tool.AC4 — Given a query, when executed, then it runs as `certiq_reader` inside a Prisma interactive transaction that sets `TRANSACTION READ ONLY` and `LOCAL statement_timeout`; a timeout is reported as `TIMEOUT`.
5. certified-metric-tool.AC5 — Given result rows backed by < k patients, then their value is null and `suppressed: true` before returning.
6. certified-metric-tool.AC6 — Given the codebase, then raw-unsafe Prisma APIs appear only in the allow-listed files (ADR-0006).
7. certified-metric-tool.AC7 — Given seed=42, then the generated dataset is identical on every run (eval ground truth depends on it).
## Edge Cases Covered
- Ratio with zero denominator → `NULLIF` → value null (not suppressed).
- Extra keys (e.g. `sql`) in input → rejected by `.strict()`.
- `start >= end` → rejected.
## Error Handling
- All expected failures are `Result` errors; never thrown.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| certified-metric-tool.UT02 | AC1 | revenue by product, TX, monthly | params `[start,end,['TX'],100]`; SQL has no literals |
| certified-metric-tool.UT03 | AC2 | `lifetime_value` | NOT_CERTIFIED |
| certified-metric-tool.UT04 | AC3 | `new_patients` by `product_line` | INVALID_QUERY |
| certified-metric-tool.UT05 | AC3 | state filter `TX'; DROP TABLE…` | INVALID_QUERY |
| certified-metric-tool.UT06 | AC1 | input with `sql` key; reversed range | schema rejects |
| certified-metric-tool.UT07 | AC7 | generate dataset twice | identical; 6000/5994/17518/1434 rows |
| certified-metric-tool.UT08 | AC7 | patient row keys | no identifying fields |
| certified-metric-tool.UT09 | AC6 | scan apps/ and packages/ | no unsafe call outside allow-list |
| certified-metric-tool.IT01 | AC4 | reader selects base table `orders` | error |
| certified-metric-tool.IT02 | AC1 | array param `state = ANY($1::text[])` | numbers returned |
| certified-metric-tool.IT03 | AC4 | `pg_sleep(1)` with 200ms timeout | `TIMEOUT` |
| certified-metric-tool.IT04 | AC4 | `CREATE TABLE` on the **admin** connection | rejected (txn is read-only) |
## Explicitly Out of Scope
- Joins across metrics; derived metrics; caching.
## Non-Functional Constraints (from constitution.md)
- Default query timeout 3s; limit ≤ 500 rows.
