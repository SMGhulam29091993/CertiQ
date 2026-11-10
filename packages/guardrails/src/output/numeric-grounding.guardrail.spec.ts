import { describe, expect, it } from 'vitest';
import type { AnalystAnswer, MetricResult, MetricRow, OutputGuardrailInput } from '@certiq/contracts';
import { NumericGroundingGuardrail } from './numeric-grounding.guardrail';

type Figure = AnalystAnswer['figures'][number];

const row = (value: number | null, state: string, suppressed = false): MetricRow => ({
  period: null,
  dimensions: { state },
  value,
  patientCount: suppressed ? 4 : 80,
  suppressed,
});

const result = (metricId: string, unit: MetricResult['unit'], rows: MetricRow[]): MetricResult => ({
  metricId,
  metricVersion: '1.0.0',
  registryVersion: '1.0.0',
  unit,
  query: { metric: metricId, dimensions: ['state'], filters: {}, time_range: { start: '2026-05-01', end: '2026-06-01' }, limit: 100 },
  rows,
  suppressedRows: rows.filter((r) => r.suppressed).length,
  sql: 'SELECT …',
  params: [],
  executedAt: '2026-11-08T00:00:00Z',
  durationMs: 3,
});

const figure = (value: number, unit: Figure['unit'], metricId: string, label = 'value'): Figure => ({
  label,
  value,
  unit,
  metricId,
  metricVersion: '1.0.0',
  period: null,
});

const input = (summary: string, figures: Figure[], evidence: MetricResult[], status: AnalystAnswer['status'] = 'answered'): OutputGuardrailInput => ({
  question: 'q',
  answer: { status, summary, figures, suggestedMetrics: [] },
  evidence,
});

const revenue = result('gross_revenue', 'usd', [row(670138.48, 'TX'), row(120000, 'AZ')]);
const orders = result('completed_orders', 'count', [row(120, 'TX'), row(30, 'CA'), row(null, 'AZ', true)]);
const approval = result('consultation_approval_rate', 'ratio', [row(0.123, 'TX')]);

const g = new NumericGroundingGuardrail();

describe('NumericGroundingGuardrail', () => {
  it('answer-guardrails.UT04 — figure 670138.48 usd matching an evidence row is allowed', async () => {
    const v = await g.check(
      input('Gross revenue in Texas was $670,138.48 for May 2026.', [figure(670138.48, 'usd', 'gross_revenue')], [revenue]),
    );
    expect(v.action).toBe('allow');
  });

  it('answer-guardrails.UT05 — "$700,000" in the summary but not among figures is blocked', async () => {
    const v = await g.check(
      input('Gross revenue was about $700,000.', [figure(670138.48, 'usd', 'gross_revenue')], [revenue]),
    );
    expect(v.action).toBe('block');
    if (v.action === 'block') {
      expect(v.reason).toContain('$700,000');
      expect(v.userMessage).not.toContain('700');
    }
  });

  it('answer-guardrails.UT07 — figure equal to a suppressed row’s pre-suppression value (6) is blocked', async () => {
    const v = await g.check(input('Arizona had 6 completed orders.', [figure(6, 'count', 'completed_orders')], [orders]));
    expect(v.action).toBe('block');
  });

  it('allows a ratio 0.123 written as "12.3%"', async () => {
    const v = await g.check(
      input('The approval rate was 12.3%.', [figure(0.123, 'ratio', 'consultation_approval_rate')], [approval]),
    );
    expect(v.action).toBe('allow');
  });

  it('ignores the year "2026" and the date "2026-05-01" in prose', async () => {
    const v = await g.check(
      input('Between 2026-05-01 and 2026-06-01 (Q2 2026), Texas had 120 orders.', [figure(120, 'count', 'completed_orders')], [orders]),
    );
    expect(v.action).toBe('allow');
  });

  it('allows a total equal to the sum of non-suppressed rows', async () => {
    const v = await g.check(input('There were 150 completed orders in total.', [figure(150, 'count', 'completed_orders', 'total')], [orders]));
    expect(v.action).toBe('allow');
  });

  it('blocks a total that only matches if the suppressed row were included', async () => {
    const v = await g.check(input('There were 156 completed orders in total.', [figure(156, 'count', 'completed_orders', 'total')], [orders]));
    expect(v.action).toBe('block');
  });

  it('allows refused answers without checking numbers', async () => {
    const v = await g.check(input('I can’t answer that; 42 is not certified.', [], [], 'refused'));
    expect(v.action).toBe('allow');
  });

  it('blocks a figure whose value only exists under a different metricId', async () => {
    const v = await g.check(input('Texas had 120 orders.', [figure(120, 'count', 'gross_revenue')], [orders, revenue]));
    expect(v.action).toBe('block');
  });

  it('allows prose that rounds a figure ("$670K", "12%") but not a coarse rounding ("$1M")', async () => {
    const figs = [figure(670138.48, 'usd', 'gross_revenue'), figure(0.123, 'ratio', 'consultation_approval_rate')];
    const ev = [revenue, approval];
    expect((await g.check(input('Revenue was $670K at a 12% approval rate.', figs, ev))).action).toBe('allow');
    expect((await g.check(input('Revenue was $1M.', figs, ev))).action).toBe('block');
  });

  it('treats a zero figure exactly rather than relatively', async () => {
    const zero = result('completed_orders', 'count', [row(0, 'NM')]);
    expect((await g.check(input('New Mexico had 0 orders.', [figure(0, 'count', 'completed_orders')], [zero]))).action).toBe('allow');
    expect((await g.check(input('New Mexico had 0.001 orders.', [figure(0.001, 'count', 'completed_orders')], [zero]))).action).toBe('block');
  });

  it('blocks a $ amount that only matches a non-usd figure', async () => {
    const v = await g.check(input('That is $120.', [figure(120, 'count', 'completed_orders')], [orders]));
    expect(v.action).toBe('block');
  });
});
