import { afterAll, describe, expect, it } from 'vitest';
import type { CompiledQuery } from '@certiq/contracts';
import { PrismaMetricRepository } from './prisma-metric-repository';
import { YamlMetricRegistry } from './yaml-metric-registry';

// Integration tests hit the real seeded database (constitution.md › Testing Discipline).
// They load the repo-root .env and skip cleanly when no database is configured.
try {
  process.loadEnvFile(new URL('../../../.env', import.meta.url));
} catch {
  /* no .env — tests below skip */
}

const ADMIN = process.env.DATABASE_ADMIN_URL;
const READER = process.env.DATABASE_READONLY_URL;
const metric = YamlMetricRegistry.fromFile().getMetric('completed_orders')!;
const raw = (sql: string, params: unknown[] = []): CompiledQuery => ({
  sql,
  params,
  metric,
  query: { metric: metric.id, dimensions: [], filters: {}, time_range: { start: '2026-01-01', end: '2026-02-01' }, limit: 1 },
});

describe.skipIf(!ADMIN || !READER)('PrismaMetricRepository (integration)', () => {
  const reader = PrismaMetricRepository.fromUrl(READER!);
  const admin = PrismaMetricRepository.fromUrl(ADMIN!);
  afterAll(async () => {
    await Promise.all([reader.close(), admin.close()]);
  });

  it('certified-metric-tool.IT02 — binds array params and returns numbers', async () => {
    const res = await reader.execute(
      raw(`SELECT COUNT(*)::int AS value FROM v_orders WHERE state = ANY($1::text[]) AND order_date >= $2::date`, [['TX'], '2026-01-01']),
      { timeoutMs: 3000 },
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(typeof res.value[0]?.value).toBe('number');
  });

  it('certified-metric-tool.IT03 — reports a statement timeout as TIMEOUT', async () => {
    const res = await reader.execute(raw('SELECT pg_sleep(1)'), { timeoutMs: 200 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('TIMEOUT');
  });

  it('certified-metric-tool.IT04 — transaction is READ ONLY even on the admin connection', async () => {
    const res = await admin.execute(raw('CREATE TABLE should_not_exist (a int)'), { timeoutMs: 3000 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('DB_ERROR');
  });

  it('certified-metric-tool.IT01 — reader role cannot read base tables', async () => {
    const res = await reader.execute(raw('SELECT 1 FROM orders LIMIT 1'), { timeoutMs: 3000 });
    expect(res.ok).toBe(false);
  });
});
