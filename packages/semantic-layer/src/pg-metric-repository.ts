import pg from 'pg';
import {
  err,
  ok,
  type CompiledQuery,
  type IMetricRepository,
  type RawMetricRow,
  type Result,
} from '@certiq/contracts';

/**
 * Datastore access only. Connects with the READ-ONLY role, runs every query in a
 * READ ONLY transaction with a per-query statement_timeout. No business logic.
 */
export class PgMetricRepository implements IMetricRepository {
  constructor(private readonly pool: pg.Pool) {}

  static fromUrl(connectionString: string): PgMetricRepository {
    return new PgMetricRepository(new pg.Pool({ connectionString, max: 5 }));
  }

  async execute(query: CompiledQuery, options: { timeoutMs: number }): Promise<Result<RawMetricRow[]>> {
    const timeout = Math.max(100, Math.floor(options.timeoutMs));
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query(`SET LOCAL statement_timeout = ${timeout}`);
      const res = await client.query(query.sql, query.params as unknown[]);
      await client.query('COMMIT');
      return ok(res.rows as RawMetricRow[]);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      const code = (e as { code?: string }).code;
      if (code === '57014') return err('TIMEOUT', `Query exceeded ${timeout}ms.`);
      return err('DB_ERROR', 'Metric query failed.', { pgCode: code });
    } finally {
      client.release();
    }
  }

  async ping(): Promise<Result<true>> {
    try {
      await this.pool.query('SELECT 1');
      return ok(true);
    } catch (e) {
      return err('DB_ERROR', `Database unreachable: ${(e as Error).message}`);
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
