import { z } from 'zod';

/** Startup config validation — the API refuses to boot on bad values (constitution.md). */

const optionalNumber = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), 'must be a non-negative number');

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  CERTIQ_MODEL_FAST: z.string().min(1),
  CERTIQ_MODEL_STRONG: z.string().min(1),
  CERTIQ_PRICE_FAST_INPUT_PER_MTOK: optionalNumber,
  CERTIQ_PRICE_FAST_OUTPUT_PER_MTOK: optionalNumber,
  CERTIQ_PRICE_STRONG_INPUT_PER_MTOK: optionalNumber,
  CERTIQ_PRICE_STRONG_OUTPUT_PER_MTOK: optionalNumber,
  CERTIQ_MAX_TOOL_CALLS: z.coerce.number().int().min(1).max(10).default(4),
  CERTIQ_MAX_INPUT_TOKENS: z.coerce.number().int().min(1000).default(40_000),
  CERTIQ_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).default(4_000),
  CERTIQ_MAX_USD_PER_QUESTION: optionalNumber,
  CERTIQ_MIN_GROUP_SIZE: z.coerce.number().int().min(2).default(10),
  DATABASE_READONLY_URL: z.string().url(),
  CERTIQ_QUERY_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(3_000),
  API_PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    console.error(`✖ Invalid configuration — refusing to start:\n${lines.join('\n')}`);
    process.exit(1);
  }
  return parsed.data;
}
