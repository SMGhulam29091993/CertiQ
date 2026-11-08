import { describe, expect, it } from 'vitest';
import { MetricQuerySchema } from '@certiq/contracts';
import { YamlMetricRegistry } from './yaml-metric-registry';
import { SqlQueryCompiler } from './sql-query-compiler';

const registry = YamlMetricRegistry.fromFile();
const compiler = new SqlQueryCompiler(registry);
const q = (input: unknown) => MetricQuerySchema.parse(input);

describe('YamlMetricRegistry', () => {
  it('metric-registry.UT01 — loads the real metrics.yaml with integrity checks', () => {
    expect(registry.listMetrics().length).toBeGreaterThan(5);
    expect(registry.getMetric('gross_revenue_usd')?.unit).toBe('usd');
  });

  it('metric-registry.UT03 — suggests close certified metrics for a synonym', () => {
    expect(registry.suggest('revenue').map((m) => m.id)).toContain('gross_revenue_usd');
  });

  it('metric-registry.UT02 — rejects a metric referencing an unknown dimension', () => {
    const bad = `registry_version: 1.0.0
dimensions: [{ id: state, label: State, column: state }]
metrics:
  - { id: x_metric, version: 1.0.0, label: X, description: a bad metric here, owner: o, unit: count,
      source: v_orders, aggregation: COUNT(*), time_column: order_date, dimensions: [nope], certified_at: "2026-11-08" }`;
    expect(() => YamlMetricRegistry.fromYaml(bad)).toThrow(/unknown dimension "nope"/);
  });
});

describe('SqlQueryCompiler', () => {
  it('certified-metric-tool.UT02 — binds every value as a parameter, never interpolates', () => {
    const res = compiler.compile(
      q({
        metric: 'gross_revenue_usd',
        dimensions: ['product_line'],
        filters: { state: ['TX'] },
        grain: 'month',
        time_range: { start: '2026-07-01', end: '2026-10-01' },
      }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.sql).not.toContain('TX');
    expect(res.value.sql).not.toContain('2026-07-01');
    expect(res.value.params).toEqual(['2026-07-01', '2026-10-01', ['TX'], 100]);
    expect(res.value.sql).toContain('FROM v_orders');
  });

  it('certified-metric-tool.UT03 — refuses an uncertified metric with suggestions', () => {
    const res = compiler.compile(q({ metric: 'lifetime_value', time_range: { start: '2026-01-01', end: '2026-02-01' } }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('NOT_CERTIFIED');
  });

  it('certified-metric-tool.UT04 — refuses a dimension the metric does not allow', () => {
    const res = compiler.compile(
      q({ metric: 'new_patients', dimensions: ['product_line'], time_range: { start: '2026-01-01', end: '2026-02-01' } }),
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('INVALID_QUERY');
  });

  it('certified-metric-tool.UT05 — refuses filter values outside the dimension allow-list', () => {
    const res = compiler.compile(
      q({
        metric: 'completed_orders',
        filters: { state: ["TX'; DROP TABLE orders; --"] },
        time_range: { start: '2026-01-01', end: '2026-02-01' },
      }),
    );
    expect(res.ok).toBe(false);
  });

  it('certified-metric-tool.UT06 — schema rejects raw SQL keys and reversed ranges', () => {
    expect(MetricQuerySchema.safeParse({ metric: 'x', sql: 'SELECT 1', time_range: { start: '2026-01-01', end: '2026-02-01' } }).success).toBe(false);
    expect(MetricQuerySchema.safeParse({ metric: 'x', time_range: { start: '2026-02-01', end: '2026-01-01' } }).success).toBe(false);
  });
});
