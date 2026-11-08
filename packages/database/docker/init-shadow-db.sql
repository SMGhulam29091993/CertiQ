-- Runs once when the Docker volume is first created.
-- Shadow database for `prisma migrate diff --from-migrations` (pnpm db:drift).
CREATE DATABASE certiq_shadow;
