import type { LLMUsage, ModelTier } from './llm';

export interface TraceEvent {
  readonly at: string;
  readonly name: string;
  readonly data?: Readonly<Record<string, unknown>>;
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
}

export interface ITracer {
  event(name: string, data?: Record<string, unknown>): void;
  span<T>(name: string, fn: () => Promise<T>): Promise<T>;
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
