import type { IBudget, ITracer, TraceEvent, TraceSummary } from '@certiq/contracts';

/** Collects a per-run event log that the API returns and the UI renders. Never logs PHI. */
export class InMemoryTracer implements ITracer {
  private readonly events: TraceEvent[] = [];
  private readonly started = Date.now();
  private llmCalls = 0;

  constructor(
    private readonly runId: string,
    private readonly budget: IBudget,
    private readonly echo = false,
  ) {}

  event(name: string, data?: Record<string, unknown>): void {
    if (name.startsWith('llm.')) this.llmCalls++;
    const e: TraceEvent = { at: new Date().toISOString(), name, ...(data ? { data } : {}) };
    this.events.push(e);
    if (this.echo) console.log(`[${this.runId}] ${name}`, data ?? '');
  }

  async span<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    try {
      return await fn();
    } finally {
      this.event(`${name}.done`, { ms: Date.now() - t0 });
    }
  }

  summary(): TraceSummary {
    const b = this.budget.snapshot();
    return {
      runId: this.runId,
      durationMs: Date.now() - this.started,
      llmCalls: this.llmCalls,
      toolCalls: b.toolCalls,
      inputTokens: b.inputTokens,
      outputTokens: b.outputTokens,
      costUsd: b.costUsd,
      events: [...this.events],
    };
  }
}
