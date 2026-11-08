import {
  err,
  MetricQuerySchema,
  ok,
  type IGuardrailChain,
  type IMetricRegistry,
  type IMetricRepository,
  type IMetricTool,
  type IQueryCompiler,
  type MetricResult,
  type MetricRow,
  type RawMetricRow,
  type Result,
  type ToolDefinition,
} from '@certiq/contracts';

export interface CertifiedMetricToolOptions {
  readonly timeoutMs: number;
}

/**
 * The ONLY way an agent can obtain a number.
 * validate (Zod) → compile (registry-checked) → execute (read-only) → tool-result guardrails.
 * Depends only on interfaces (DIP); every collaborator is injected.
 */
export class CertifiedMetricTool implements IMetricTool {
  readonly name = 'query_certified_metric';

  constructor(
    private readonly registry: IMetricRegistry,
    private readonly compiler: IQueryCompiler,
    private readonly repository: IMetricRepository,
    private readonly resultGuardrails: IGuardrailChain<MetricResult>,
    private readonly options: CertifiedMetricToolOptions,
  ) {}

  definition(): ToolDefinition {
    const metrics = this.registry.listMetrics();
    const dimensions = this.registry.listDimensions();
    return {
      name: this.name,
      description: [
        'Returns values for ONE certified business metric. This is the only source of numbers —',
        'never estimate, compute or recall figures yourself. Call once per metric needed.',
        'If the user asks for something no metric covers, do not call this tool; refuse as not certified.',
        '',
        'Certified metrics:',
        ...metrics.map((m) => `- ${m.id} (v${m.version}, ${m.unit}): ${m.description} Dimensions: ${m.dimensions.join(', ')}`),
      ].join('\n'),
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['metric', 'time_range'],
        properties: {
          metric: { type: 'string', enum: metrics.map((m) => m.id) },
          dimensions: {
            type: 'array',
            maxItems: 2,
            items: { type: 'string', enum: dimensions.map((d) => d.id) },
            description: 'Breakdown dimensions (must be allowed for the chosen metric).',
          },
          filters: {
            type: 'object',
            description: 'dimension id → list of allowed values to keep.',
            additionalProperties: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
          },
          grain: { type: 'string', enum: ['day', 'week', 'month'], description: 'Omit for a single total.' },
          time_range: {
            type: 'object',
            additionalProperties: false,
            required: ['start', 'end'],
            properties: {
              start: { type: 'string', description: 'Inclusive, YYYY-MM-DD.' },
              end: { type: 'string', description: 'Exclusive, YYYY-MM-DD.' },
            },
          },
          limit: { type: 'integer', minimum: 1, maximum: 500 },
        },
      },
    };
  }

  async run(input: unknown): Promise<Result<MetricResult>> {
    const parsed = MetricQuerySchema.safeParse(input);
    if (!parsed.success) {
      return err('INVALID_QUERY', 'Tool input failed validation.', parsed.error.issues);
    }

    const compiled = this.compiler.compile(parsed.data);
    if (!compiled.ok) return compiled;

    const started = Date.now();
    const rows = await this.repository.execute(compiled.value, { timeoutMs: this.options.timeoutMs });
    if (!rows.ok) return rows;

    const { metric, query } = compiled.value;
    const result: MetricResult = {
      metricId: metric.id,
      metricVersion: metric.version,
      registryVersion: this.registry.version(),
      unit: metric.unit,
      query,
      rows: rows.value.map((r) => toMetricRow(r, query.dimensions)),
      suppressedRows: 0,
      sql: compiled.value.sql,
      params: compiled.value.params,
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    };

    const guarded = await this.resultGuardrails.run(result);
    if (guarded.blocked) {
      return err('GUARDRAIL_BLOCKED', guarded.userMessage, { guardrail: guarded.by, reason: guarded.reason });
    }
    return ok(guarded.value);
  }
}

function toMetricRow(raw: RawMetricRow, dimensionIds: readonly string[]): MetricRow {
  const dimensions: Record<string, string> = {};
  for (const id of dimensionIds) dimensions[id] = String(raw[id]);
  const value = raw.value === null || raw.value === undefined ? null : Number(raw.value);
  return {
    period: typeof raw.period === 'string' ? raw.period : null,
    dimensions,
    value: value !== null && Number.isFinite(value) ? value : null,
    patientCount: Number(raw.patient_count ?? 0),
    suppressed: false,
  };
}
