import { describe, expect, it } from 'vitest';
import type { AskResponse, IOrchestrator, MetricResult } from '@certiq/contracts';
import { GoldenCaseSchema, type GoldenCase } from './golden-case';
import { runCases } from './runner';

const QUERY = { metric: 'gross_revenue_usd', time_range: { start: '2026-01-01', end: '2026-02-01' } };

const golden = (id: string, today: string, expect: Record<string, unknown>): GoldenCase =>
  GoldenCaseSchema.parse({ id, kind: 'regression', category: 'numeric', question: `q for ${id}`, today, expect, source: 'unit test fixture' });

const response = (status: AskResponse['status'], value?: number): AskResponse => ({
  status,
  answer:
    status === 'answered' || status === 'refused'
      ? {
          status,
          summary: 's',
          figures: value === undefined ? [] : [{ label: 'v', value, unit: 'usd', metricId: 'm', metricVersion: '1', period: null }],
          suggestedMetrics: [],
        }
      : undefined,
  evidence: [],
  userMessage: 'm',
  guardrailsApplied: [],
  trace: { runId: 'r', durationMs: 1, llmCalls: 1, toolCalls: 1, inputTokens: 10, outputTokens: 5, costUsd: 0.002, events: [], steps: [] },
});

const truth = (value: number): MetricResult => ({
  metricId: 'gross_revenue_usd',
  metricVersion: '1.0.0',
  registryVersion: '1.0.0',
  unit: 'usd',
  query: { ...QUERY, dimensions: [], filters: {}, limit: 100 },
  rows: [{ period: null, dimensions: {}, value, patientCount: 50, suppressed: false }],
  suppressedRows: 0,
  sql: 'SELECT 1',
  params: [],
  executedAt: '2026-02-15T00:00:00Z',
  durationMs: 1,
});

describe('runCases (eval-harness.T02)', () => {
  it('runs each case `trials` times with that case’s today injected', async () => {
    const todays: string[] = [];
    const asked: string[] = [];
    const orchestrator: IOrchestrator = {
      ask: async (q) => {
        asked.push(q);
        return response('refused');
      },
    };
    const cases = [golden('a', '2026-01-10', { status: 'refused' }), golden('b', '2026-03-20', { status: 'refused' })];
    const runs = await runCases(cases, 3, {
      orchestratorFor: (t) => {
        todays.push(t);
        return orchestrator;
      },
      groundTruth: async () => ({ error: 'should not be called' }),
    });
    expect(todays).toEqual(['2026-01-10', '2026-03-20']);
    expect(asked).toEqual(['q for a', 'q for a', 'q for a', 'q for b', 'q for b', 'q for b']);
    expect(runs.map((r) => r.trials.length)).toEqual([3, 3]);
    expect(runs[0]?.trials.every((t) => t.grade.pass)).toBe(true);
  });

  it('computes ground truth once per case and grades numerics against it', async () => {
    let truthCalls = 0;
    const runs = await runCases([golden('n', '2026-02-15', { status: 'answered', query: QUERY })], 2, {
      orchestratorFor: () => ({ ask: async () => response('answered', 1000) }),
      groundTruth: async () => {
        truthCalls++;
        return { certified: truth(1000) };
      },
    });
    expect(truthCalls).toBe(1);
    expect(runs[0]?.trials.map((t) => t.grade.pass)).toEqual([true, true]);
  });

  it('a ground-truth failure (returned or thrown) is a harness error, not an agent failure', async () => {
    const c = golden('n', '2026-02-15', { status: 'answered', query: QUERY });
    const deps = { orchestratorFor: () => ({ ask: async () => response('answered', 1000) }) };
    const returned = await runCases([c], 1, { ...deps, groundTruth: async () => ({ error: 'DB_ERROR' }) });
    const thrown = await runCases([c], 1, {
      ...deps,
      groundTruth: async () => {
        throw new Error('connection refused');
      },
    });
    for (const r of [returned, thrown]) {
      expect(r[0]?.trials[0]?.grade.pass).toBe(false);
      expect(r[0]?.trials[0]?.grade.harnessError).toBe(true);
    }
  });

  it('an orchestrator throw counts against the agent and has unknown cost', async () => {
    let t = 0;
    const runs = await runCases([golden('a', '2026-01-10', { status: 'refused' })], 1, {
      orchestratorFor: () => ({
        ask: async () => {
          throw new Error('boom');
        },
      }),
      groundTruth: async () => ({ error: 'unused' }),
      now: () => (t += 50),
    });
    const trial = runs[0]?.trials[0];
    expect(trial?.status).toBe('threw');
    expect(trial?.grade.harnessError).toBe(false);
    expect(trial?.costUsd).toBeNull();
    expect(trial?.latencyMs).toBe(50);
  });

  it('rejects a non-positive trial count', async () => {
    await expect(
      runCases([], 0, { orchestratorFor: () => ({ ask: async () => response('refused') }), groundTruth: async () => ({ error: '' }) }),
    ).rejects.toThrow(/positive integer/);
  });
});
