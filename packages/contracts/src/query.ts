import { z } from 'zod';
import type { MetricDefinition } from './metric';
import type { Result } from './result';
import type { ToolDefinition } from './llm';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const GrainSchema = z.enum(['day', 'week', 'month']);
export type Grain = z.infer<typeof GrainSchema>;

/**
 * The ONLY thing the model is allowed to produce to get a number.
 * No SQL, no expressions — just ids that the registry will validate.
 */
export const MetricQuerySchema = z
  .object({
    metric: z.string().min(1),
    dimensions: z.array(z.string()).max(2).default([]),
    filters: z.record(z.string(), z.array(z.string()).min(1).max(20)).default({}),
    grain: GrainSchema.optional(),
    time_range: z.object({
      start: z.string().regex(ISO_DATE),
      /** Exclusive. */
      end: z.string().regex(ISO_DATE),
    }),
    limit: z.number().int().min(1).max(500).default(100),
  })
  .strict()
  .refine((q) => q.time_range.start < q.time_range.end, {
    message: 'time_range.start must be before time_range.end',
    path: ['time_range'],
  });
export type MetricQuery = z.infer<typeof MetricQuerySchema>;

export interface CompiledQuery {
  readonly sql: string;
  readonly params: readonly unknown[];
  readonly metric: MetricDefinition;
  readonly query: MetricQuery;
}

/** Turns a validated MetricQuery into parameterized SQL. Pure — no I/O. */
export interface IQueryCompiler {
  compile(query: MetricQuery): Result<CompiledQuery>;
}

/** Raw row as returned by the datastore, before mapping. */
export type RawMetricRow = Record<string, unknown>;

/** Executes compiled SQL. Datastore access only — no business logic. */
export interface IMetricRepository {
  execute(query: CompiledQuery, options: { timeoutMs: number }): Promise<Result<RawMetricRow[]>>;
  ping(): Promise<Result<true>>;
}

export interface MetricRow {
  readonly period: string | null;
  readonly dimensions: Readonly<Record<string, string>>;
  /** null when suppressed by the small-group guardrail. */
  readonly value: number | null;
  readonly patientCount: number;
  readonly suppressed: boolean;
}

export interface MetricResult {
  readonly metricId: string;
  readonly metricVersion: string;
  readonly registryVersion: string;
  readonly unit: MetricDefinition['unit'];
  readonly query: MetricQuery;
  readonly rows: readonly MetricRow[];
  readonly suppressedRows: number;
  /** Shown to the user for auditability. Parameters are shown separately, never interpolated. */
  readonly sql: string;
  readonly params: readonly unknown[];
  readonly executedAt: string;
  readonly durationMs: number;
}

/**
 * What an agent depends on (Interface Segregation): the agent never sees the
 * registry, compiler or repository — only a tool it can describe and run.
 */
export interface IMetricTool {
  readonly name: string;
  definition(): ToolDefinition;
  run(input: unknown): Promise<Result<MetricResult>>;
}
