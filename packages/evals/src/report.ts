import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaseRun } from './runner';

/**
 * eval-harness.T04 — aggregation (pure) + rendering. Harness errors are counted apart
 * from agent results so a broken ground-truth query never reads as a regression or
 * as a pass; pass rates are computed over graded (non-harness-error) cases only.
 */

export const REPORTS_DIR = fileURLToPath(new URL('../reports', import.meta.url));

export interface CaseSummary {
  readonly id: string;
  readonly kind: 'capability' | 'regression';
  readonly category: string;
  readonly trials: number;
  readonly passedTrials: number;
  /** pass@1 as defined by AC5: at least one trial passed. */
  readonly pass1: boolean;
  /** pass^k: every trial passed. */
  readonly passK: boolean;
  readonly harnessError: boolean;
  /** First failure reason seen, so the table explains itself. */
  readonly firstFailure: string | null;
}

export interface CategorySummary {
  readonly category: string;
  readonly cases: number;
  readonly graded: number;
  readonly pass1: number;
  readonly passK: number;
  readonly harnessErrors: number;
}

export interface EvalReport {
  readonly generatedAt: string;
  readonly trialsPerCase: number;
  readonly cases: readonly CaseSummary[];
  readonly categories: readonly CategorySummary[];
  readonly totals: {
    readonly cases: number;
    readonly graded: number;
    readonly pass1: number;
    readonly passK: number;
    readonly harnessErrors: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    /** null if ANY trial's cost is null — a partial sum would understate spend. */
    readonly costUsd: number | null;
    readonly latencyP50Ms: number | null;
    readonly latencyP95Ms: number | null;
  };
}

/** Nearest-rank percentile: always returns an observed value, no interpolation. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1] as number;
}

export function sumCost(costs: readonly (number | null)[]): number | null {
  let total = 0;
  for (const c of costs) {
    if (c === null) return null;
    total += c;
  }
  return total;
}

export function summarizeCase(run: CaseRun): CaseSummary {
  const passed = run.trials.filter((t) => t.grade.pass).length;
  const failure = run.trials
    .flatMap((t) => t.grade.results)
    .find((r) => !r.pass);
  return {
    id: run.case.id,
    kind: run.case.kind,
    category: run.case.category,
    trials: run.trials.length,
    passedTrials: passed,
    pass1: passed > 0,
    passK: run.trials.length > 0 && passed === run.trials.length,
    harnessError: run.trials.some((t) => t.grade.harnessError),
    firstFailure: failure ? `${failure.grader}: ${failure.reason}` : null,
  };
}

export function buildReport(runs: readonly CaseRun[], trialsPerCase: number, generatedAt: string): EvalReport {
  const cases = runs.map(summarizeCase);
  const graded = cases.filter((c) => !c.harnessError);

  const categories = [...new Set(cases.map((c) => c.category))].sort().map((category): CategorySummary => {
    const inCat = cases.filter((c) => c.category === category);
    const g = inCat.filter((c) => !c.harnessError);
    return {
      category,
      cases: inCat.length,
      graded: g.length,
      pass1: g.filter((c) => c.pass1).length,
      passK: g.filter((c) => c.passK).length,
      harnessErrors: inCat.length - g.length,
    };
  });

  const trials = runs.flatMap((r) => r.trials);
  const latencies = trials.map((t) => t.latencyMs);
  return {
    generatedAt,
    trialsPerCase,
    cases,
    categories,
    totals: {
      cases: cases.length,
      graded: graded.length,
      pass1: graded.filter((c) => c.pass1).length,
      passK: graded.filter((c) => c.passK).length,
      harnessErrors: cases.length - graded.length,
      inputTokens: trials.reduce((n, t) => n + t.inputTokens, 0),
      outputTokens: trials.reduce((n, t) => n + t.outputTokens, 0),
      costUsd: sumCost(trials.map((t) => t.costUsd)),
      latencyP50Ms: percentile(latencies, 50),
      latencyP95Ms: percentile(latencies, 95),
    },
  };
}

export function renderReport(r: EvalReport): string {
  const k = r.trialsPerCase;
  const lines: string[] = [];
  lines.push(`\n${'case'.padEnd(42)} ${'kind'.padEnd(10)} ${'trials'.padEnd(7)} pass@1 pass^${k}`);
  for (const c of r.cases) {
    const mark = c.harnessError ? 'HARNESS' : c.passK ? '✔' : c.pass1 ? '~' : '✖';
    lines.push(
      `${c.id.padEnd(42)} ${c.kind.padEnd(10)} ${`${c.passedTrials}/${c.trials}`.padEnd(7)} ${(c.pass1 ? 'yes' : 'no').padEnd(6)} ${c.passK ? 'yes' : 'no'}  ${mark}`,
    );
    if (c.firstFailure && !c.passK) lines.push(`    ↳ ${c.firstFailure}`);
  }
  lines.push(`\n${'category'.padEnd(16)} ${'graded'.padEnd(7)} ${'pass@1'.padEnd(7)} ${`pass^${k}`.padEnd(7)} harness-errors`);
  for (const c of r.categories) {
    lines.push(
      `${c.category.padEnd(16)} ${String(c.graded).padEnd(7)} ${String(c.pass1).padEnd(7)} ${String(c.passK).padEnd(7)} ${c.harnessErrors}`,
    );
  }
  const t = r.totals;
  const ms = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v)}ms`);
  lines.push(
    `\nTotal: pass@1 ${t.pass1}/${t.graded} · pass^${k} ${t.passK}/${t.graded} · harness errors ${t.harnessErrors}`,
    `Tokens: in ${t.inputTokens} · out ${t.outputTokens} · cost ${t.costUsd === null ? 'unknown (prices not configured or a trial had no trace)' : `$${t.costUsd.toFixed(4)}`}`,
    `Latency: p50 ${ms(t.latencyP50Ms)} · p95 ${ms(t.latencyP95Ms)}`,
  );
  return lines.join('\n');
}

export function writeReport(r: EvalReport, dir: string = REPORTS_DIR): string {
  mkdirSync(dir, { recursive: true });
  // Colons are invalid in Windows filenames; keep the timestamp sortable.
  const path = join(dir, `${r.generatedAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(path, `${JSON.stringify(r, null, 2)}\n`);
  return path;
}
