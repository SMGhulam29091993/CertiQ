import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import { MetricQuerySchema } from '@certiq/contracts';

export const GOLDEN_DIR = fileURLToPath(new URL('../golden', import.meta.url));

/**
 * A golden case never stores an expected NUMBER. It stores the expected certified
 * QUERY; the runner executes that query through the deterministic tool to get the
 * ground truth. So reseeding data never invalidates the golden set — only a change
 * in meaning does.
 */
export const GoldenCaseSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    kind: z.enum(['capability', 'regression']),
    category: z.enum(['numeric', 'refusal', 'clarification', 'phi', 'injection', 'suppression']),
    question: z.string().min(3),
    /** Fixed "today" so relative dates ("last month") are deterministic. */
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    expect: z
      .object({
        status: z.enum(['answered', 'refused', 'needs_clarification', 'blocked']),
        blocked_by: z.string().optional(),
        refusal_reason: z.enum(['not_certified', 'out_of_scope', 'phi_request', 'insufficient_data']).optional(),
        /** Ground-truth certified query (numeric cases). */
        query: MetricQuerySchema.optional(),
        /** Relative tolerance for numeric comparison. */
        tolerance: z.number().min(0).max(0.05).default(0.005),
        must_mention_suppression: z.boolean().default(false),
      })
      .strict(),
    tags: z.array(z.string()).default([]),
    /** Where this case came from — a real failure, a policy rule, an adversarial probe. */
    source: z.string().min(3),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.expect.status === 'answered' && !c.expect.query) {
      ctx.addIssue({ code: 'custom', message: 'answered cases need expect.query (ground truth)' });
    }
    if (c.expect.status === 'blocked' && !c.expect.blocked_by) {
      ctx.addIssue({ code: 'custom', message: 'blocked cases need expect.blocked_by' });
    }
  });
export type GoldenCase = z.infer<typeof GoldenCaseSchema>;

export function loadGoldenCases(dir: string = GOLDEN_DIR): GoldenCase[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort();
  const cases: GoldenCase[] = [];
  const errors: string[] = [];
  for (const f of files) {
    const parsed = GoldenCaseSchema.safeParse(parse(readFileSync(join(dir, f), 'utf8')));
    if (parsed.success) cases.push(parsed.data);
    else errors.push(`${f}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  }
  if (errors.length > 0) throw new Error(`Invalid golden cases:\n  ${errors.join('\n  ')}`);
  const ids = new Set(cases.map((c) => c.id));
  if (ids.size !== cases.length) throw new Error('Duplicate golden case ids.');
  return cases;
}
