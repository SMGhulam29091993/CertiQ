import { z } from 'zod';

/**
 * Canonical shape of the certified metric registry (metrics.yaml).
 * Ownership: this schema is the single definition of "what a certified metric is"
 * — see .ai-context/ownership_index.md#metric-definition.
 */

const SNAKE = /^[a-z][a-z0-9_]*$/;

export const MetricUnitSchema = z.enum(['count', 'usd', 'ratio', 'hours']);
export type MetricUnit = z.infer<typeof MetricUnitSchema>;

export const DimensionDefinitionSchema = z.object({
  id: z.string().regex(SNAKE),
  label: z.string().min(1),
  /** Column name in the source view. Trusted (code-reviewed), never model-supplied. */
  column: z.string().regex(SNAKE),
  /** Optional closed list of valid values, used for validation and entity resolution. */
  values: z.array(z.string()).optional(),
});
export type DimensionDefinition = z.infer<typeof DimensionDefinitionSchema>;

export const MetricDefinitionSchema = z.object({
  id: z.string().regex(SNAKE),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  label: z.string().min(1),
  description: z.string().min(10),
  owner: z.string().min(1),
  synonyms: z.array(z.string()).default([]),
  unit: MetricUnitSchema,
  /** Source view name. Every view exposes patient_id for small-group suppression. */
  source: z.string().regex(SNAKE),
  /** Aggregate SQL expression. Trusted (code-reviewed), never model-supplied. */
  aggregation: z.string().min(1),
  time_column: z.string().regex(SNAKE),
  /** Dimension ids this metric may be broken down or filtered by. */
  dimensions: z.array(z.string().regex(SNAKE)),
  certified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

export const RegistryFileSchema = z.object({
  registry_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  dimensions: z.array(DimensionDefinitionSchema).min(1),
  metrics: z.array(MetricDefinitionSchema).min(1),
});
export type RegistryFile = z.infer<typeof RegistryFileSchema>;

/** Read-only view of the certified catalog. */
export interface IMetricRegistry {
  version(): string;
  listMetrics(): readonly MetricDefinition[];
  listDimensions(): readonly DimensionDefinition[];
  getMetric(id: string): MetricDefinition | undefined;
  getDimension(id: string): DimensionDefinition | undefined;
  /** Closest certified metric ids for an uncertified request — powers "did you mean". */
  suggest(term: string, limit?: number): readonly MetricDefinition[];
}
