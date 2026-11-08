import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import {
  RegistryFileSchema,
  type DimensionDefinition,
  type IMetricRegistry,
  type MetricDefinition,
  type RegistryFile,
} from '@certiq/contracts';

export const DEFAULT_REGISTRY_PATH = fileURLToPath(new URL('../metrics.yaml', import.meta.url));

/**
 * Loads and validates metrics.yaml. Construction fails loudly on any invalid
 * definition or dangling dimension reference — fail fast at boot, not at query time.
 */
export class YamlMetricRegistry implements IMetricRegistry {
  private readonly metrics: ReadonlyMap<string, MetricDefinition>;
  private readonly dimensions: ReadonlyMap<string, DimensionDefinition>;

  constructor(private readonly file: RegistryFile) {
    this.dimensions = new Map(file.dimensions.map((d) => [d.id, d]));
    this.metrics = new Map(file.metrics.map((m) => [m.id, m]));
    this.assertIntegrity();
  }

  static fromYaml(text: string): YamlMetricRegistry {
    const parsed = RegistryFileSchema.safeParse(parse(text));
    if (!parsed.success) {
      throw new Error(`metrics.yaml is invalid: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    return new YamlMetricRegistry(parsed.data);
  }

  static fromFile(path: string = DEFAULT_REGISTRY_PATH): YamlMetricRegistry {
    return YamlMetricRegistry.fromYaml(readFileSync(path, 'utf8'));
  }

  version(): string {
    return this.file.registry_version;
  }

  listMetrics(): readonly MetricDefinition[] {
    return [...this.metrics.values()];
  }

  listDimensions(): readonly DimensionDefinition[] {
    return [...this.dimensions.values()];
  }

  getMetric(id: string): MetricDefinition | undefined {
    return this.metrics.get(id);
  }

  getDimension(id: string): DimensionDefinition | undefined {
    return this.dimensions.get(id);
  }

  /**
   * Keyword-overlap ranking over id, label and synonyms. Deliberately simple:
   * at ~10 metrics this beats embeddings on cost and determinism (ADR-0001).
   * At catalog scale this method is the seam where hybrid retrieval plugs in.
   */
  suggest(term: string, limit = 3): readonly MetricDefinition[] {
    const tokens = tokenize(term);
    if (tokens.size === 0) return [];
    return this.listMetrics()
      .map((m) => {
        const haystack = tokenize([m.id, m.label, ...m.synonyms].join(' '));
        let score = 0;
        for (const t of tokens) if (haystack.has(t)) score++;
        return { m, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.m.id.localeCompare(b.m.id))
      .slice(0, limit)
      .map((s) => s.m);
  }

  private assertIntegrity(): void {
    const errors: string[] = [];
    if (this.metrics.size !== this.file.metrics.length) errors.push('duplicate metric ids');
    if (this.dimensions.size !== this.file.dimensions.length) errors.push('duplicate dimension ids');
    for (const m of this.metrics.values()) {
      for (const d of m.dimensions) {
        if (!this.dimensions.has(d)) errors.push(`metric "${m.id}" references unknown dimension "${d}"`);
      }
    }
    if (errors.length > 0) throw new Error(`metrics.yaml integrity check failed: ${errors.join('; ')}`);
  }
}

const STOP = new Set(['the', 'a', 'an', 'of', 'by', 'per', 'in', 'for', 'our', 'what', 'is', 'was', 'usd']);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}
