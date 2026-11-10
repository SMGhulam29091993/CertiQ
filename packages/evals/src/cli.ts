import { loadGoldenCases, type GoldenCase } from './golden-case';
import type { GroundTruthInput } from './graders';
import { EXIT, baselineFromReport, gate, loadBaseline, writeBaseline } from './gate';
import { buildReport, renderReport, writeReport } from './report';
import { runCases } from './runner';

/**
 * Eval harness entry point — the only eval file that touches env/infra.
 *   --validate-only   load + schema-check golden cases (no DB/LLM needed)
 *   --trials N        trials per case (default 3) — eval-harness.AC5
 *   --fast            regression cases only, 1 trial (used by the Stop hook) — eval-harness.T05
 *   --write-baseline  record current results as the new baseline (human-run only; hook-blocked for agents)
 *
 * Exit codes (see EXIT in gate.ts): 0 ok · 1 regression vs baseline · 2 setup/usage ·
 * 3 harness errors only.
 */

/** Checked before any work so a missing key is exit 2 (setup), never confused with a regression. */
const REQUIRED_ENV = ['DATABASE_READONLY_URL', 'ANTHROPIC_API_KEY', 'CERTIQ_MODEL_FAST', 'CERTIQ_MODEL_STRONG'] as const;

function parseArgs(argv: readonly string[]): { flags: Set<string>; trials: number | null; error: string | null } {
  const flags = new Set<string>();
  let trials: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === '--trials' || a.startsWith('--trials=')) {
      const raw = a.includes('=') ? a.split('=')[1] : argv[++i];
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) return { flags, trials, error: `--trials needs a positive integer, got "${raw}"` };
      trials = n;
    } else flags.add(a);
  }
  return { flags, trials, error: null };
}

async function main(): Promise<number> {
  const { flags, trials: trialsArg, error } = parseArgs(process.argv.slice(2));
  if (error) {
    console.error(`✖ ${error}`);
    return EXIT.setup;
  }
  const all = loadGoldenCases();

  const byKind = all.reduce<Record<string, number>>((acc, c) => {
    acc[`${c.kind}/${c.category}`] = (acc[`${c.kind}/${c.category}`] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`✔ ${all.length} golden cases valid`);
  for (const [k, n] of Object.entries(byKind).sort()) console.log(`   ${k.padEnd(28)} ${n}`);

  if (flags.has('--validate-only')) return EXIT.ok;

  const fast = flags.has('--fast');
  const writeBaselineFlag = flags.has('--write-baseline');
  // A 1-trial or regression-only run is too weak to become the bar.
  if (fast && writeBaselineFlag) {
    console.error('✖ --write-baseline cannot be combined with --fast.');
    return EXIT.setup;
  }

  const missing = REQUIRED_ENV.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    console.error(
      `\n✖ Eval setup incomplete — missing ${missing.join(', ')}.\n` +
        '  Copy .env.example to .env, run `pnpm db:up && pnpm db:setup`, and set ANTHROPIC_API_KEY.',
    );
    return EXIT.setup;
  }

  const cases = fast ? all.filter((c) => c.kind === 'regression') : all;
  const trials = fast ? 1 : (trialsArg ?? 3);

  // Imported lazily so --validate-only and the setup-error path need no Prisma client / SDK.
  const [{ loadConfig }, { buildContainer }, guardrails, semantic] = await Promise.all([
    import('@certiq/api/config'),
    import('@certiq/api/container'),
    import('@certiq/guardrails'),
    import('@certiq/semantic-layer'),
  ]);
  const config = loadConfig();

  // ONE container with a mutable "today", rather than one per case: buildContainer opens a
  // DB pool each call, and the runner is strictly sequential, so a mutable today is safe.
  // This is still the real API wiring (same guardrails, prompts, budgets).
  let today = '';
  const container = buildContainer(config, { today: () => today });

  // Ground truth reuses the container's registry + repository (same data, same pool).
  // `raw` exists only to detect the agent leaking values the guardrail hid (graders.ts contract).
  const compiler = new semantic.SqlQueryCompiler(container.registry);
  const opts = { timeoutMs: config.CERTIQ_QUERY_TIMEOUT_MS };
  const certifiedTool = new semantic.CertifiedMetricTool(
    container.registry,
    compiler,
    container.repository,
    new guardrails.GuardrailChain([new guardrails.SmallGroupSuppressionGuardrail(config.CERTIQ_MIN_GROUP_SIZE)]),
    opts,
  );
  const rawTool = new semantic.CertifiedMetricTool(
    container.registry,
    compiler,
    container.repository,
    new guardrails.GuardrailChain([]),
    opts,
  );

  const groundTruth = async (c: GoldenCase): Promise<GroundTruthInput> => {
    const certified = await certifiedTool.run(c.expect.query);
    if (!certified.ok) return { error: `${certified.error.code} ${certified.error.message}` };
    if (!c.expect.must_mention_suppression) return { certified: certified.value };
    const raw = await rawTool.run(c.expect.query);
    if (!raw.ok) return { error: `raw: ${raw.error.code} ${raw.error.message}` };
    return { certified: certified.value, raw: raw.value };
  };

  console.log(`\nRunning ${cases.length} case(s) × ${trials} trial(s)${fast ? ' (--fast)' : ''}…`);
  try {
    const runs = await runCases(cases, trials, {
      orchestratorFor: (t) => {
        today = t;
        return container.orchestrator;
      },
      groundTruth,
      onTrial: (c, i, t) =>
        process.stdout.write(`  ${t.grade.pass ? '✔' : t.grade.harnessError ? '!' : '✖'} ${c.id} #${i + 1}\n`),
    });

    const report = buildReport(runs, trials, new Date().toISOString());
    console.log(renderReport(report));
    console.log(`\nReport: ${writeReport(report)}`);

    if (writeBaselineFlag) {
      writeBaseline(baselineFromReport(report, container.registry.version()));
      console.log('✔ Baseline written (review and commit it).');
      return EXIT.ok;
    }

    const result = gate(report, loadBaseline());
    for (const n of result.notes) console.log(`ℹ ${n}`);
    if (result.regressions.length > 0) {
      console.error(`\n✖ Regression below baseline: ${result.regressions.join(', ')}`);
    }
    return result.exitCode;
  } finally {
    // IMetricRepository has no close(); the Prisma implementation does.
    await (container.repository as { close?: () => Promise<void> }).close?.();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    // An unexpected crash is not "regression" (1) and not "setup" (2); treat as harness.
    process.exit(EXIT.harness);
  });
