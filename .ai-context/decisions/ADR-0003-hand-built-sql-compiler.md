# ADR-0003: Hand-built SQL compiler over `pg`, not an ORM; schema re-created, not migrated

## Context
Queries are dynamic (0–2 group-by dimensions, optional time grain, IN-filters) and aggregate-heavy.
Prisma handles dynamic aggregates poorly (`$queryRaw` would bypass its safety anyway); a query
builder adds a dependency for ~80 lines of logic.

## Decision
`SqlQueryCompiler` builds SQL from registry-owned identifiers (regex-validated twice) and binds every
value as a parameter. `PgMetricRepository` runs it in a `READ ONLY` transaction with `statement_timeout`.
The demo schema is dropped and re-created by `pnpm db:migrate` (no migration chain).

## Consequences
+ The whole "model can't shape SQL" argument fits on one screen and is unit-tested.
+ No ORM in the query path.
− A real deployment needs versioned migrations (would add an ADR then).
