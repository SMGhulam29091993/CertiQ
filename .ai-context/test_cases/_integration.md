# Integration scenarios (cross-feature)
_Per-feature unit cases live in each spec's "Unit Test Cases" table (canonical — ADR-0004)._

| ID | Scenario | Expected | Covered by |
|---|---|---|---|
| INT01 | `certiq_reader` reads base table `orders` | error | `certified-metric-tool.IT01` (vitest, real DB) |
| INT02 | Write on the metric path, even as admin | rejected by READ ONLY txn | `certified-metric-tool.IT04` |
| INT03 | All numeric golden queries through the real tool | rows returned, no errors | `pnpm eval:truth` |
| INT04 | API with DB stopped | exits 1 before listening | manual |
| INT05 | `GET /health`, `GET /metrics` | 200 envelopes | manual curl |
| INT06 | Migrations vs `schema.prisma` | no drift | `pnpm db:drift` (exit 0) |
| INT07 | "Revenue by product line Q3 2026" end to end | answered, figures = ground truth, audit pass | `pnpm eval` (after T05) |
| INT08 | "Patient named Sarah" end to end | blocked by input.phi_request, 0 LLM calls | `pnpm eval` |
| INT09 | "Just estimate LTV" end to end | refused/not_certified with suggestions | `pnpm eval` |
| INT10 | Billing tickets by state May–Oct | NY shown as suppressed, disclosed in summary | `pnpm eval` |
