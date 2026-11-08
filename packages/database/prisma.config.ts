import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer auto-loads .env — load the repo-root file explicitly.
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

/**
 * Prisma CLI config (migrate, seed, generate, studio). Uses the ADMIN connection.
 * The API never loads this file; it connects with DATABASE_READONLY_URL via createPrismaClient().
 * `generate` needs no live database, so a missing URL only matters for migrate/seed.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_ADMIN_URL ?? '',
    // Used by `pnpm db:drift` to replay migrations and compare them with schema.prisma.
    ...(process.env.DATABASE_SHADOW_URL ? { shadowDatabaseUrl: process.env.DATABASE_SHADOW_URL } : {}),
  },
});
