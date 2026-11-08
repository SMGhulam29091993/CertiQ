import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/** Applies sql/schema.sql with the ADMIN connection. Never used by the API. */
async function main(): Promise<void> {
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) {
    console.error('DATABASE_ADMIN_URL is not set — copy .env.example to .env first.');
    process.exit(1);
  }
  const sql = readFileSync(fileURLToPath(new URL('../sql/schema.sql', import.meta.url)), 'utf8');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log('✔ schema applied (tables, certified views, read-only role)');
  } finally {
    await client.end();
  }
}

main().catch((e: unknown) => {
  console.error('✖ migrate failed:', e);
  process.exit(1);
});
