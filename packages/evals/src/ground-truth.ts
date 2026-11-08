import { GuardrailChain, SmallGroupSuppressionGuardrail } from '@certiq/guardrails';
import {
  CertifiedMetricTool,
  PrismaMetricRepository,
  SqlQueryCompiler,
  YamlMetricRegistry,
} from '@certiq/semantic-layer';
import { loadGoldenCases } from './golden-case';

/**
 * `pnpm eval:truth` — runs each numeric golden case's expected query through the
 * deterministic certified tool (no LLM) and prints the ground truth. Use it when
 * authoring a new case to check the query is sensible and produces rows.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_READONLY_URL;
  if (!url) throw new Error('DATABASE_READONLY_URL is not set.');

  const registry = YamlMetricRegistry.fromFile();
  const repository = PrismaMetricRepository.fromUrl(url);
  const tool = new CertifiedMetricTool(
    registry,
    new SqlQueryCompiler(registry),
    repository,
    new GuardrailChain([new SmallGroupSuppressionGuardrail(Number(process.env.CERTIQ_MIN_GROUP_SIZE ?? 10))]),
    { timeoutMs: Number(process.env.CERTIQ_QUERY_TIMEOUT_MS ?? 3000) },
  );

  let failures = 0;
  for (const c of loadGoldenCases()) {
    if (!c.expect.query) continue;
    const res = await tool.run(c.expect.query);
    if (!res.ok) {
      failures++;
      console.log(`✖ ${c.id}: ${res.error.code} ${res.error.message}`);
      continue;
    }
    const r = res.value;
    const preview = r.rows
      .slice(0, 4)
      .map((row) => `${[row.period, ...Object.values(row.dimensions)].filter(Boolean).join('/') || 'total'}=${row.value ?? '∅'}`)
      .join(', ');
    console.log(
      `✔ ${c.id.padEnd(40)} ${r.metricId}@${r.metricVersion} rows=${r.rows.length} suppressed=${r.suppressedRows} ${r.durationMs}ms\n    ${preview}${r.rows.length > 4 ? ', …' : ''}`,
    );
  }
  await repository.close();
  if (failures > 0) process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
