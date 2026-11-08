# ADR-0006: Prisma owns the schema, migrations, seed and client; metric queries stay raw, parameterized SQL

_Supersedes ADR-0003._

## Context
The team standardises on Prisma. Two very different kinds of database work exist here:
1. **Owning the database** — tables, enums, indexes, migrations, seed data, a typed client.
2. **Answering metric questions** — dynamic aggregates over certified views: `FILTER (WHERE …)`,
   `date_trunc`, `COUNT(DISTINCT patient_id)` for suppression, 0–2 group-by dimensions chosen at runtime.

Prisma's query builder (`groupBy`, `aggregate`) can't express (2): no `FILTER`, no `date_trunc`, no
`COUNT DISTINCT` alongside other aggregates, no reading arbitrary views by name at runtime. Forcing it
would mean either a weaker product or raw SQL hidden behind ORM calls.

## Decision
- **Prisma 7.10.1** (pinned; the CLI's `latest` tag pointed at an 8.0 RC on 2026-11-08) is the data layer:
  `schema.prisma` (models + enums), `prisma migrate`, `prisma.config.ts`, driver adapter `@prisma/adapter-pg`,
  generated client in `packages/database/src/generated/prisma` (git-ignored).
- What `schema.prisma` can't express — CHECK constraints, the four certified views, the
  `certiq_reader` role and grants — lives in a hand-written migration
  (`20261108000100_certified_views_and_reader_role`), applied verbatim by `prisma migrate deploy`.
- The metric path is unchanged in shape: `SqlQueryCompiler` still builds SQL from registry identifiers
  only, with every value in `params`. `PrismaMetricRepository` executes it via `tx.$queryRawUnsafe(sql, ...params)`
  inside an interactive transaction that runs `SET TRANSACTION READ ONLY` and `SET LOCAL statement_timeout`.
- `$queryRawUnsafe`/`$executeRawUnsafe` are allowed in exactly two files (the repository and the seed).
  An architecture test (`certified-metric-tool.UT09`) fails the build if any other file uses them.
- The compiler does **not** emit `Prisma.Sql` objects: keeping it free of Prisma keeps it pure,
  unit-testable without a client, and swappable (Dependency Inversion — the repository is the adapter).

## Consequences
+ One tool for schema, migrations, seeding, Studio and typed access; seed writes through typed models.
+ The "model can't shape SQL" argument is unchanged and still fits on one screen.
+ Read-only is enforced twice: by the role and by the transaction (IT04 proves the latter even on the admin connection).
− "Unsafe" appears in the codebase. It is named, fenced by a test, and explained — say this out loud in review.
− Views are invisible to Prisma's model layer (fine: nothing reads them through models).
− The Prisma CLI downloads a schema-engine binary from binaries.prisma.sh on first use; locked-down
  networks must allow it (or provide `PRISMA_SCHEMA_ENGINE_BINARY`).
