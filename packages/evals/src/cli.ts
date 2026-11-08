import { loadGoldenCases } from './golden-case';

/**
 * Eval harness entry point.
 *   --validate-only   load + schema-check golden cases (works today, no DB/LLM needed)
 *   --fast            regression cases only, 1 trial (used by the Stop hook)
 *   --write-baseline  record current results as the new baseline (human-run only)
 *
 * LIVE BUILD — eval-harness.T02–T05:
 *   T02 runner: build the real container, run each case `trials` times (default 3)
 *   T03 graders: status match · numeric match vs ground-truth query · suppression mention
 *   T04 report: pass@1, pass^3, per-category pass rate, cost/latency, regressions vs baseline
 *   T05 gate: exit 1 if any regression case drops below baseline
 */
async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const cases = loadGoldenCases();

  const byKind = cases.reduce<Record<string, number>>((acc, c) => {
    acc[`${c.kind}/${c.category}`] = (acc[`${c.kind}/${c.category}`] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`✔ ${cases.length} golden cases valid`);
  for (const [k, n] of Object.entries(byKind).sort()) console.log(`   ${k.padEnd(28)} ${n}`);

  if (args.has('--validate-only')) return;

  console.error('\n✖ Runner not implemented yet — see eval-harness.T02 in .ai-context/tasks/eval-harness.tasks.md');
  process.exit(2);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
