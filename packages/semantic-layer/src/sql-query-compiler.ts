import {
  err,
  ok,
  type CompiledQuery,
  type IMetricRegistry,
  type IQueryCompiler,
  type MetricQuery,
  type Result,
} from '@certiq/contracts';

const IDENT = /^[a-z][a-z0-9_]*$/;

/**
 * MetricQuery → parameterized SQL. Pure and deterministic.
 *
 * Security model (see constitution.md › Security Posture):
 *  - Identifiers come ONLY from the registry (regex-validated at load, re-asserted here).
 *  - Every user/model-supplied VALUE is a bind parameter ($n). Nothing is interpolated.
 *  - The model can choose ids; it can never shape SQL.
 */
export class SqlQueryCompiler implements IQueryCompiler {
  constructor(private readonly registry: IMetricRegistry) {}

  compile(query: MetricQuery): Result<CompiledQuery> {
    const metric = this.registry.getMetric(query.metric);
    if (!metric) {
      const suggestions = this.registry.suggest(query.metric).map((m) => m.id);
      return err('NOT_CERTIFIED', `"${query.metric}" is not a certified metric.`, { suggestions });
    }

    const requested = [...query.dimensions, ...Object.keys(query.filters)];
    for (const dimId of requested) {
      if (!metric.dimensions.includes(dimId)) {
        return err('INVALID_QUERY', `Dimension "${dimId}" is not allowed for metric "${metric.id}".`, {
          allowed: metric.dimensions,
        });
      }
    }
    if (new Set(query.dimensions).size !== query.dimensions.length) {
      return err('INVALID_QUERY', 'Duplicate dimensions in breakdown.');
    }

    const params: unknown[] = [];
    const bind = (v: unknown): string => {
      params.push(v);
      return `$${params.length}`;
    };

    const select: string[] = [];
    const groupBy: string[] = [];

    assertIdent(metric.source, metric.time_column);
    if (query.grain) {
      const periodExpr = `to_char(date_trunc('${query.grain}', ${metric.time_column})::date, 'YYYY-MM-DD')`;
      select.push(`${periodExpr} AS period`);
      groupBy.push(periodExpr);
    }

    for (const dimId of query.dimensions) {
      const dim = this.registry.getDimension(dimId)!;
      assertIdent(dim.column, dim.id);
      select.push(`${dim.column} AS "${dim.id}"`);
      groupBy.push(dim.column);
    }

    select.push(`(${metric.aggregation})::float8 AS value`);
    select.push(`COUNT(DISTINCT patient_id)::int AS patient_count`);

    const where = [
      `${metric.time_column} >= ${bind(query.time_range.start)}::date`,
      `${metric.time_column} < ${bind(query.time_range.end)}::date`,
    ];

    for (const [dimId, values] of Object.entries(query.filters)) {
      const dim = this.registry.getDimension(dimId)!;
      if (dim.values) {
        const unknown = values.filter((v) => !dim.values!.includes(v));
        if (unknown.length > 0) {
          return err('INVALID_QUERY', `Unknown value(s) for ${dim.id}: ${unknown.join(', ')}`, { allowed: dim.values });
        }
      }
      where.push(`${dim.column} = ANY(${bind(values)}::text[])`);
    }

    const parts = [
      `SELECT ${select.join(', ')}`,
      `FROM ${metric.source}`,
      `WHERE ${where.join(' AND ')}`,
    ];
    if (groupBy.length > 0) {
      parts.push(`GROUP BY ${groupBy.join(', ')}`);
      parts.push(`ORDER BY ${groupBy.join(', ')}`);
    }
    parts.push(`LIMIT ${bind(query.limit)}`);

    return ok({ sql: parts.join('\n'), params, metric, query });
  }
}

function assertIdent(...ids: string[]): void {
  for (const id of ids) {
    if (!IDENT.test(id)) throw new Error(`Unsafe identifier in registry: "${id}"`);
  }
}
