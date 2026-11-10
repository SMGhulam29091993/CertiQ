import type { LLMUsage, ModelTier } from './llm';

export interface TraceEvent {
  readonly at: string;
  readonly name: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export type TraceStepKind = 'agent' | 'guardrail';

/**
 * How a pipeline step ended. Agents: the analyst's answer status, the auditor's verdict, or
 * error. Guardrails: their verdict action.
 */
export type TraceStepStatus =
  | 'answered'
  | 'refused'
  | 'needs_clarification'
  | 'passed'
  | 'failed'
  | 'allowed'
  | 'transformed'
  | 'blocked'
  | 'error';

/**
 * One agent or guardrail step, in execution order. The console renders these as the
 * "Execution trace"; counts are this step's share of the run budget, not running totals.
 */
export interface TraceStep {
  /** 'analyst' | 'auditor' | a guardrail id such as 'output.numeric_grounding'. */
  readonly name: string;
  readonly kind: TraceStepKind;
  readonly durationMs: number;
  readonly llmCalls: number;
  readonly toolCalls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Repair turns taken (analyst/auditor reformat after unparseable output). */
  readonly retries: number;
  readonly status: TraceStepStatus;
  /** Error code or block reason. Never PHI, never a model message. */
  readonly detail?: string;
}

/** What a step reports about its own ending; the tracer measures everything else. */
export interface TraceStepOutcome {
  readonly status: TraceStepStatus;
  readonly detail?: string;
}

export interface TraceSummary {
  readonly runId: string;
  readonly durationMs: number;
  readonly llmCalls: number;
  readonly toolCalls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** null when prices are not configured — never an invented number. */
  readonly costUsd: number | null;
  readonly events: readonly TraceEvent[];
  /** Agent and guardrail steps in execution order. Steps that never ran are absent. */
  readonly steps: readonly TraceStep[];
}

/** Event-name suffix an agent emits once per repair turn; the tracer counts these as retries. */
export const RETRY_EVENT_SUFFIX = '.repair';

export interface ITracer {
  event(name: string, data?: Record<string, unknown>): void;
  span<T>(name: string, fn: () => Promise<T>): Promise<T>;
  /**
   * Runs an agent step and records it with its duration, LLM/tool calls, tokens and retries,
   * measured as the change in the run budget across `fn`. A throw is recorded as `error` and rethrown.
   */
  step<T>(name: string, kind: TraceStepKind, fn: () => Promise<T>, outcome: (result: T) => TraceStepOutcome): Promise<T>;
  /** Records a step measured elsewhere (guardrails are timed by their chain, which has no run context). */
  recordStep(step: TraceStep): void;
  summary(): TraceSummary;
}

export interface BudgetLimits {
  readonly maxToolCalls: number;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  /** null disables the dollar cap (prices not configured). */
  readonly maxUsd: number | null;
}

export interface IBudget {
  chargeLLM(tier: ModelTier, usage: LLMUsage): void;
  chargeToolCall(): void;
  /** Returns a reason string when any limit is exceeded, otherwise null. */
  exceeded(): string | null;
  snapshot(): { toolCalls: number; inputTokens: number; outputTokens: number; costUsd: number | null };
}

/** Everything a single question's run needs, created fresh per question. */
export interface RunContext {
  readonly runId: string;
  readonly tracer: ITracer;
  readonly budget: IBudget;
}

export interface IRunContextFactory {
  create(): RunContext;
}
