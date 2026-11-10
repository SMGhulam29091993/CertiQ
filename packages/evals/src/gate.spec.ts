import { describe, expect, it } from 'vitest';
import { GoldenCaseSchema, type GoldenCase } from './golden-case';
import { EXIT, baselineFromReport, gate, type Baseline } from './gate';
import { buildReport } from './report';
import type { CaseRun, TrialRecord } from './runner';

const golden = (id: string, kind: 'regression' | 'capability' = 'regression'): GoldenCase =>
  GoldenCaseSchema.parse({ id, kind, category: 'refusal', question: 'what?', today: '2026-02-15', expect: { status: 'refused' }, source: 'unit test fixture' });

const trial = (pass: boolean, harnessError = false): TrialRecord => ({
  status: 'refused',
  grade: { pass, harnessError, results: [{ grader: 'status', pass, reason: 'r' }] },
  latencyMs: 1,
  inputTokens: 1,
  outputTokens: 1,
  costUsd: null,
});

const report = (runs: CaseRun[]) => buildReport(runs, 3, '2026-11-10T00:00:00.000Z');
const baseline = (cases: Baseline['cases']): Baseline => ({ recordedAt: '2026-11-01T00:00:00Z', registryVersion: '1.0.0', cases });

describe('baseline gate (eval-harness.T05)', () => {
  it('eval-harness.UT04 — regression case 3/3 → 2/3 vs baseline 3/3 → exit 1', () => {
    const r = report([{ case: golden('refusal-cac'), trials: [trial(true), trial(false), trial(true)] }]);
    const g = gate(r, baseline({ 'refusal-cac': { passK: 1, trials: 3 } }));
    expect(g.regressions).toEqual(['refusal-cac']);
    expect(g.exitCode).toBe(EXIT.regression);
  });

  it('holding at baseline passes; capability cases are never gated', () => {
    const r = report([
      { case: golden('steady'), trials: [trial(true), trial(true), trial(true)] },
      { case: golden('cap', 'capability'), trials: [trial(false), trial(false), trial(false)] },
    ]);
    const g = gate(r, baseline({ steady: { passK: 1, trials: 3 }, cap: { passK: 1, trials: 3 } }));
    expect(g.exitCode).toBe(EXIT.ok);
    expect(g.regressions).toEqual([]);
  });

  it('an empty baseline gates nothing and says so', () => {
    const r = report([{ case: golden('x'), trials: [trial(false)] }]);
    const g = gate(r, baseline({}));
    expect(g.exitCode).toBe(EXIT.ok);
    expect(g.notes.join(' ')).toMatch(/No baseline recorded/);
  });

  it('harness errors are exit 3 and never reported as regressions — but a real regression still wins', () => {
    const broken = { case: golden('broken'), trials: [trial(false, true)] };
    const g1 = gate(report([broken]), baseline({ broken: { passK: 1, trials: 3 } }));
    expect(g1.regressions).toEqual([]);
    expect(g1.exitCode).toBe(EXIT.harness);
    const g2 = gate(report([broken, { case: golden('dropped'), trials: [trial(false)] }]), baseline({ dropped: { passK: 1, trials: 3 } }));
    expect(g2.exitCode).toBe(EXIT.regression);
  });

  it('baselineFromReport records pass^k as 0|1 and skips harness-error cases', () => {
    const r = report([
      { case: golden('a'), trials: [trial(true), trial(true), trial(true)] },
      { case: golden('b'), trials: [trial(true), trial(false), trial(true)] },
      { case: golden('c'), trials: [trial(false, true)] },
    ]);
    const b = baselineFromReport(r, '1.2.0');
    expect(b.cases).toEqual({ a: { passK: 1, trials: 3 }, b: { passK: 0, trials: 3 } });
    expect(b).toMatchObject({ recordedAt: '2026-11-10T00:00:00.000Z', registryVersion: '1.2.0' });
  });
});
