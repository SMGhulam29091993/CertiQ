import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GoldenCaseSchema, type GoldenCase } from './golden-case';
import { buildReport, percentile, renderReport, sumCost, writeReport } from './report';
import type { CaseRun, TrialRecord } from './runner';

const golden = (id: string, category = 'refusal'): GoldenCase =>
  GoldenCaseSchema.parse({ id, kind: 'regression', category, question: 'what?', today: '2026-02-15', expect: { status: 'refused' }, source: 'unit test fixture' });

const trial = (pass: boolean, over: Partial<TrialRecord> = {}, harnessError = false): TrialRecord => ({
  status: 'refused',
  grade: { pass, harnessError, results: [{ grader: 'status', pass, reason: pass ? 'ok' : 'wrong status' }] },
  latencyMs: 100,
  inputTokens: 100,
  outputTokens: 20,
  costUsd: 0.01,
  ...over,
});

const run = (c: GoldenCase, trials: TrialRecord[]): CaseRun => ({ case: c, trials });

describe('report math (eval-harness.T04)', () => {
  it('pass@1 = any trial passed; pass^k = all trials passed', () => {
    const r = buildReport(
      [
        run(golden('all'), [trial(true), trial(true), trial(true)]),
        run(golden('some'), [trial(true), trial(false), trial(true)]),
        run(golden('none'), [trial(false), trial(false), trial(false)]),
      ],
      3,
      '2026-11-10T00:00:00.000Z',
    );
    expect(r.cases.map((c) => [c.id, c.pass1, c.passK])).toEqual([
      ['all', true, true],
      ['some', true, false],
      ['none', false, false],
    ]);
    expect(r.totals).toMatchObject({ graded: 3, pass1: 2, passK: 1, inputTokens: 900, outputTokens: 180 });
    expect(r.cases[1]?.firstFailure).toBe('status: wrong status');
  });

  it('nearest-rank percentiles', () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([5], 95)).toBe(5);
    const xs = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
    expect(percentile(xs, 50)).toBe(10);
    expect(percentile(xs, 95)).toBe(19);
    expect(percentile([300, 100, 200], 50)).toBe(200);
  });

  it('total cost is null if any trial cost is null — never a partial sum', () => {
    expect(sumCost([0.01, 0.02])).toBeCloseTo(0.03);
    expect(sumCost([0.01, null, 0.02])).toBeNull();
    const r = buildReport([run(golden('a'), [trial(true), trial(true, { costUsd: null })])], 2, 'x');
    expect(r.totals.costUsd).toBeNull();
  });

  it('counts harness errors separately and excludes them from pass rates', () => {
    const r = buildReport(
      [run(golden('ok', 'numeric'), [trial(true)]), run(golden('broken', 'numeric'), [trial(false, {}, true)])],
      1,
      'x',
    );
    expect(r.totals).toMatchObject({ cases: 2, graded: 1, pass1: 1, passK: 1, harnessErrors: 1 });
    expect(r.categories).toEqual([{ category: 'numeric', cases: 2, graded: 1, pass1: 1, passK: 1, harnessErrors: 1 }]);
    expect(renderReport(r)).toMatch(/HARNESS/);
  });

  it('writes the JSON report to a timestamped file', () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'certiq-report-')), 'reports');
    const r = buildReport([run(golden('a'), [trial(true)])], 1, '2026-11-10T12:34:56.789Z');
    const path = writeReport(r, dir);
    expect(path).toMatch(/2026-11-10T12-34-56-789Z\.json$/);
    expect(JSON.parse(readFileSync(path, 'utf8')).totals.passK).toBe(1);
  });
});
