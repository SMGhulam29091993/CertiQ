import { createPrismaClient, type PrismaClient } from '@certiq/database';
import {
  err,
  ok,
  type CompiledQuery,
  type IMetricRepository,
  type RawMetricRow,
  type Result,
} from '@certiq/contracts';

/**
 * Datastore access only. Connects with the READ-ONLY role; every query runs in a Prisma
 * interactive transaction marked READ ONLY with its own statement_timeout. No business logic.
 *
 * Why `$queryRawUnsafe` (ADR-0006): metric queries are dynamic aggregates over certified views
 * (FILTER, date_trunc, COUNT DISTINCT) that Prisma's query builder can't express. The SQL text is
 * built ONLY from registry identifiers by SqlQueryCompiler; every value arrives in `params` and is
 * bound by the driver ($1…$n). This is the ONLY `Unsafe` call site in the repo — keep it that way
 * (Gate 2 checklist).
 */
export class PrismaMetricRepository implements IMetricRepository {
  constructor(private readonly prisma: PrismaClient) {}

  static fromUrl(connectionString: string): PrismaMetricRepository {
    return new PrismaMetricRepository(createPrismaClient(connectionString));
  }

  async execute(query: CompiledQuery, options: { timeoutMs: number }): Promise<Result<RawMetricRow[]>> {
    const timeout = Math.max(100, Math.floor(options.timeoutMs));
    try {
      const rows = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
          await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${timeout}`);
          return tx.$queryRawUnsafe<RawMetricRow[]>(query.sql, ...query.params);
        },
        // Prisma's own transaction timeout sits just above the DB timeout so the DB reports first.
        { timeout: timeout + 2_000, maxWait: 2_000 },
      );
      return ok(rows);
    } catch (e) {
      if (isStatementTimeout(e)) return err('TIMEOUT', `Query exceeded ${timeout}ms.`);
      return err('DB_ERROR', 'Metric query failed.', { kind: (e as Error).name });
    }
  }

  async ping(): Promise<Result<true>> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return ok(true);
    } catch (e) {
      return err('DB_ERROR', `Database unreachable: ${(e as Error).message}`);
    }
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

/**
 * Postgres reports a statement timeout as SQLSTATE 57014. Through the pg driver adapter it may
 * surface nested in the Prisma error's meta, so check structurally and by message.
 */
function isStatementTimeout(e: unknown): boolean {
  const text = (() => {
    try {
      return `${(e as Error)?.message ?? ''} ${JSON.stringify(e)}`;
    } catch {
      return String(e);
    }
  })();
  return text.includes('57014') || /statement timeout/i.test(text);
}
