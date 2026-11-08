import { readFileSync } from 'node:fs';
import type { IMetricRegistry, IMetricRepository, IOrchestrator } from '@certiq/contracts';
import {
  AnalystAgent,
  AuditorAgent,
  Orchestrator,
  PROMPT_PATHS,
  RunContextFactory,
  type PriceTable,
} from '@certiq/agents';
import {
  CitationGuardrail,
  GuardrailChain,
  MaxLengthGuardrail,
  NumericGroundingGuardrail,
  PhiRequestGuardrail,
  PromptInjectionGuardrail,
  SmallGroupSuppressionGuardrail,
} from '@certiq/guardrails';
import { AnthropicProvider } from '@certiq/llm';
import {
  CertifiedMetricTool,
  PrismaMetricRepository,
  SqlQueryCompiler,
  YamlMetricRegistry,
} from '@certiq/semantic-layer';
import type { AppConfig } from './config';

/**
 * COMPOSITION ROOT — the only file in the codebase that calls `new` on a concrete
 * class from another package. Everything else receives interfaces (DIP).
 * To swap an implementation (another LLM, another datastore), change it here only.
 */
export interface Container {
  readonly registry: IMetricRegistry;
  readonly repository: IMetricRepository;
  readonly orchestrator: IOrchestrator;
}

export function buildContainer(config: AppConfig): Container {
  // ── Semantic layer ────────────────────────────────────────────
  const registry = YamlMetricRegistry.fromFile();
  const repository = PrismaMetricRepository.fromUrl(config.DATABASE_READONLY_URL);
  const compiler = new SqlQueryCompiler(registry);
  const metricTool = new CertifiedMetricTool(
    registry,
    compiler,
    repository,
    new GuardrailChain([new SmallGroupSuppressionGuardrail(config.CERTIQ_MIN_GROUP_SIZE)]),
    { timeoutMs: config.CERTIQ_QUERY_TIMEOUT_MS },
  );

  // ── LLM ───────────────────────────────────────────────────────
  const llm = new AnthropicProvider({
    apiKey: config.ANTHROPIC_API_KEY,
    models: { fast: config.CERTIQ_MODEL_FAST, strong: config.CERTIQ_MODEL_STRONG },
  });

  // ── Agents ────────────────────────────────────────────────────
  const today = () => new Date().toISOString().slice(0, 10);
  const analyst = new AnalystAgent(llm, metricTool, {
    systemPrompt: readFileSync(PROMPT_PATHS.analyst, 'utf8'),
    maxTokensPerCall: 1500,
    today,
  });
  const auditor = new AuditorAgent(llm, {
    systemPrompt: readFileSync(PROMPT_PATHS.auditor, 'utf8'),
    maxTokens: 800,
  });

  // ── Guardrails + orchestration ────────────────────────────────
  const orchestrator = new Orchestrator({
    inputGuardrails: new GuardrailChain([
      new MaxLengthGuardrail(500),
      new PhiRequestGuardrail(),
      new PromptInjectionGuardrail(),
    ]),
    analyst,
    outputGuardrails: new GuardrailChain([new CitationGuardrail(), new NumericGroundingGuardrail()]),
    auditor,
    contexts: new RunContextFactory(
      {
        maxToolCalls: config.CERTIQ_MAX_TOOL_CALLS,
        maxInputTokens: config.CERTIQ_MAX_INPUT_TOKENS,
        maxOutputTokens: config.CERTIQ_MAX_OUTPUT_TOKENS,
        maxUsd: config.CERTIQ_MAX_USD_PER_QUESTION,
      },
      priceTable(config),
    ),
  });

  return { registry, repository, orchestrator };
}

function priceTable(c: AppConfig): PriceTable {
  const pair = (input: number | null, output: number | null) =>
    input === null || output === null ? null : { input, output };
  return {
    fast: pair(c.CERTIQ_PRICE_FAST_INPUT_PER_MTOK, c.CERTIQ_PRICE_FAST_OUTPUT_PER_MTOK),
    strong: pair(c.CERTIQ_PRICE_STRONG_INPUT_PER_MTOK, c.CERTIQ_PRICE_STRONG_OUTPUT_PER_MTOK),
  };
}
