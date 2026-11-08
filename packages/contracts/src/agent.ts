import { z } from 'zod';
import type { MetricResult } from './query';
import type { Result } from './result';
import type { RunContext, TraceSummary } from './observability';

/**
 * The analyst's final answer. Validated with Zod before any guardrail sees it —
 * a malformed answer is a repair-or-fail event, never passed through.
 */
export const AnalystAnswerSchema = z
  .object({
    status: z.enum(['answered', 'refused', 'needs_clarification']),
    summary: z.string().min(1).max(1200),
    figures: z
      .array(
        z.object({
          label: z.string().min(1),
          value: z.number(),
          unit: z.enum(['count', 'usd', 'ratio', 'hours']),
          metricId: z.string(),
          metricVersion: z.string(),
          period: z.string().nullable().default(null),
        }),
      )
      .default([]),
    clarifyingQuestion: z.string().optional(),
    refusalReason: z.enum(['not_certified', 'out_of_scope', 'phi_request', 'insufficient_data']).optional(),
    suggestedMetrics: z.array(z.string()).default([]),
  })
  .strict();
export type AnalystAnswer = z.infer<typeof AnalystAnswerSchema>;

export interface AnalystRun {
  readonly answer: AnalystAnswer;
  readonly evidence: readonly MetricResult[];
  readonly toolCalls: number;
}

export interface AuditIssue {
  readonly severity: 'blocker' | 'warning';
  readonly message: string;
}

export interface AuditVerdict {
  readonly pass: boolean;
  readonly issues: readonly AuditIssue[];
}

/** Generator. Uses the metric tool; may never compute numbers itself. */
export interface IAnalystAgent {
  answer(question: string, ctx: RunContext): Promise<Result<AnalystRun>>;
}

/** Judge. Separate context, read-only — can pass/fail, never rewrite numbers. */
export interface IAuditorAgent {
  audit(
    input: { question: string; answer: AnalystAnswer; evidence: readonly MetricResult[] },
    ctx: RunContext,
  ): Promise<Result<AuditVerdict>>;
}

export type AskStatus = 'answered' | 'refused' | 'needs_clarification' | 'blocked' | 'error';

export interface AskResponse {
  readonly status: AskStatus;
  readonly answer?: AnalystAnswer;
  readonly audit?: AuditVerdict;
  readonly evidence: readonly MetricResult[];
  readonly blockedBy?: { readonly guardrail: string; readonly reason: string };
  readonly userMessage: string;
  readonly guardrailsApplied: readonly string[];
  readonly trace: TraceSummary;
}

/** The single entry point the API layer depends on. */
export interface IOrchestrator {
  ask(question: string): Promise<AskResponse>;
}
