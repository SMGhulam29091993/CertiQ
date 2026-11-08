# Integration scenarios (cross-feature)
_Per-feature unit cases live in each spec's "Unit Test Cases" table (canonical — ADR-0004)._

| ID | Scenario | Expected | Covered by |
|---|---|---|---|
| INT01 | `certiq_reader` runs `SELECT … FROM orders` | permission denied | manual psql (SETUP_GUIDE §6) |
| INT02 | `certiq_reader` runs `CREATE TABLE` | read-only transaction error | manual psql |
| INT03 | All numeric golden queries through the real tool | rows returned, no errors | `pnpm eval:truth` |
| INT04 | API with DB stopped | exits 1 before listening | manual |
| INT05 | `GET /health`, `GET /metrics` | 200 envelopes | manual curl |
| INT06 | "Revenue by product line Q3 2026" end to end | answered, figures = ground truth, audit pass | `pnpm eval` (after T05) |
| INT07 | "Patient named Sarah" end to end | blocked by input.phi_request, 0 LLM calls | `pnpm eval` |
| INT08 | "Just estimate LTV" end to end | refused/not_certified with suggestions | `pnpm eval` |
| INT09 | Billing tickets by state May–Oct | NY shown as suppressed, disclosed in summary | `pnpm eval` |
