import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { EvalReport } from './report';

/**
 * eval-harness.T05 — baseline gate.
 * Per-case pass^k is binary (all trials passed), so the baseline stores it as 0 | 1
 * and a "drop" is 1 → 0. We compare pass^k rather than the per-trial pass rate because
 * AC6 gates on pass^k, and a 2/3 → 1/3 wobble on an already-flaky case is noise, not a
 * regression. A --fast run (1 trial) is gated the same way: pass^1 ≥ pass^3 in
 * expectation, so it can only under-report regressions, never invent them.
 */

export const BASELINE_PATH = fileURLToPath(new URL('../baseline.json', import.meta.url));

export const BaselineSchema = z.object({
  recordedAt: z.string().nullable(),
  registryVersion: z.string().nullable(),
  cases: z.record(z.string(), z.object({ passK: z.number().min(0).max(1), trials: z.number().int().min(1) })),
});
export type Baseline = z.infer<typeof BaselineSchema>;

/** Exit codes are part of the Stop hook's contract (.claude/hooks/stop-checks.sh). */
export const EXIT = {
  ok: 0,
  regression: 1,
  /** Missing DB/API key or bad usage — nothing was evaluated. The Stop hook skips on this. */
  setup: 2,
  /** No regression, but some cases could not be graded (ground truth failed). */
  harness: 3,
} as const;

export interface GateResult {
  readonly regressions: readonly string[];
  readonly notes: readonly string[];
  readonly exitCode: number;
}

export function loadBaseline(path: string = BASELINE_PATH): Baseline {
  return BaselineSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

export function gate(report: EvalReport, baseline: Baseline): GateResult {
  const notes: string[] = [];
  const regressions: string[] = [];

  if (Object.keys(baseline.cases).length === 0) {
    notes.push('No baseline recorded yet — regression gate not applied (a human runs `pnpm eval:baseline`).');
  }

  for (const c of report.cases) {
    if (c.kind !== 'regression') continue;
    const base = baseline.cases[c.id];
    // Can't judge a case we couldn't grade; it is reported as a harness error instead.
    if (c.harnessError) continue;
    if (!base) {
      if (Object.keys(baseline.cases).length > 0) notes.push(`${c.id}: no baseline entry (new case?) — not gated.`);
      continue;
    }
    if ((c.passK ? 1 : 0) < base.passK) regressions.push(c.id);
  }

  const harnessErrors = report.cases.filter((c) => c.harnessError).map((c) => c.id);
  if (harnessErrors.length > 0) notes.push(`Harness errors (not agent failures): ${harnessErrors.join(', ')}`);

  // Regression outranks harness errors: a real drop must block even if some truth failed.
  const exitCode = regressions.length > 0 ? EXIT.regression : harnessErrors.length > 0 ? EXIT.harness : EXIT.ok;
  return { regressions, notes, exitCode };
}

/**
 * Human-run only (`pnpm eval:baseline`); agents are hook-blocked from invoking it.
 * Records every case, not just regressions, so promoting a capability case to
 * `regression` later already has history. Harness-error cases are left out — an
 * ungraded result must not become the bar.
 */
export function baselineFromReport(report: EvalReport, registryVersion: string | null): Baseline & { _note: string } {
  const cases: Baseline['cases'] = {};
  for (const c of report.cases) {
    if (!c.harnessError) cases[c.id] = { passK: c.passK ? 1 : 0, trials: c.trials };
  }
  return {
    _note: 'Written only by `pnpm eval:baseline` (human-run). Agents are blocked from editing this file by .claude/hooks/protect-evals.sh.',
    recordedAt: report.generatedAt,
    registryVersion,
    cases,
  };
}

export function writeBaseline(b: Baseline, path: string = BASELINE_PATH): void {
  writeFileSync(path, `${JSON.stringify(b, null, 2)}\n`);
}
