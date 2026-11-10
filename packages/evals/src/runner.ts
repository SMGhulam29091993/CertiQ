import type { AskResponse, IOrchestrator } from '@certiq/contracts';
import type { GoldenCase } from './golden-case';
import { gradeCase, type CaseGrade, type GroundTruthInput } from './graders';

/**
 * eval-harness.T02 — the trial loop. Infra-free on purpose: the orchestrator and the
 * ground truth arrive as injected functions, so unit tests run without a DB or an LLM
 * and only cli.ts touches env/infra.
 */

export interface RunnerDeps {
  /**
   * Returns the orchestrator to use for a case whose fixed "today" is `today`. The real
   * implementation reuses one container with a mutable today (see cli.ts); that is safe
   * only because runCases is strictly sequential — keep it that way.
   */
  readonly orchestratorFor: (today: string) => IOrchestrator;
  /** Ground truth per the graders contract. Only called for cases with `expect.query`. */
  readonly groundTruth: (c: GoldenCase) => Promise<GroundTruthInput>;
  /** Injected so latency is testable. */
  readonly now?: () => number;
  readonly onTrial?: (c: GoldenCase, trial: number, t: TrialRecord) => void;
}

export interface TrialRecord {
  readonly status: AskResponse['status'] | 'threw';
  readonly grade: CaseGrade;
  readonly latencyMs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** null when prices are unconfigured or the trial threw — never an invented number. */
  readonly costUsd: number | null;
}

export interface CaseRun {
  readonly case: GoldenCase;
  readonly trials: readonly TrialRecord[];
}

export async function runCases(cases: readonly GoldenCase[], trials: number, deps: RunnerDeps): Promise<CaseRun[]> {
  if (!Number.isInteger(trials) || trials < 1) throw new Error(`trials must be a positive integer, got ${trials}`);
  const now = deps.now ?? (() => performance.now());
  const out: CaseRun[] = [];

  for (const c of cases) {
    // Once per case, not per trial: the query is deterministic, and recomputing it every
    // run (rather than storing numbers) is what keeps reseeding from invalidating cases.
    const truth = c.expect.query ? await safeTruth(deps, c) : undefined;
    const orchestrator = deps.orchestratorFor(c.today);
    const records: TrialRecord[] = [];

    for (let i = 0; i < trials; i++) {
      const started = now();
      let record: TrialRecord;
      try {
        const r = await orchestrator.ask(c.question);
        record = {
          status: r.status,
          grade: gradeCase(c, r, truth),
          latencyMs: now() - started,
          inputTokens: r.trace.inputTokens,
          outputTokens: r.trace.outputTokens,
          costUsd: r.trace.costUsd,
        };
      } catch (e) {
        // A throw is a bug in the system under test, so it counts against the agent
        // (not the harness) — the eval must not hide crashes as "skipped".
        const reason = `orchestrator threw: ${e instanceof Error ? e.message : String(e)}`;
        record = {
          status: 'threw',
          grade: { pass: false, harnessError: false, results: [{ grader: 'pipeline', pass: false, reason }] },
          latencyMs: now() - started,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: null,
        };
      }
      records.push(record);
      deps.onTrial?.(c, i, record);
    }
    out.push({ case: c, trials: records });
  }
  return out;
}

/** A ground-truth crash is a harness failure (spec edge case), never an agent failure. */
async function safeTruth(deps: RunnerDeps, c: GoldenCase): Promise<GroundTruthInput> {
  try {
    return await deps.groundTruth(c);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
