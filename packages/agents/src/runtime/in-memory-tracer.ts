import {
  RETRY_EVENT_SUFFIX,
  type IBudget,
  type ITracer,
  type TraceEvent,
  type TraceStep,
  type TraceStepKind,
  type TraceStepOutcome,
  type TraceSummary,
} from '@certiq/contracts';

/** Collects a per-run event log that the API returns and the UI renders. Never logs PHI. */
export class InMemoryTracer implements ITracer {
  private readonly events: TraceEvent[] = [];
  private readonly steps: TraceStep[] = [];
  private readonly started = Date.now();
  private llmCalls = 0;
  private retries = 0;

  constructor(
    private readonly runId: string,
    private readonly budget: IBudget,
    private readonly echo = false,
  ) {}

  event(name: string, data?: Record<string, unknown>): void {
    if (name.startsWith('llm.')) this.llmCalls++;
    if (name.endsWith(RETRY_EVENT_SUFFIX)) this.retries++;
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

  /**
   * Steps run one at a time (the pipeline is sequential), so the change in budget and counters
   * across `fn` is exactly this step's usage. Running steps concurrently would break that.
   */
  async step<T>(
    name: string,
    kind: TraceStepKind,
    fn: () => Promise<T>,
    outcome: (result: T) => TraceStepOutcome,
  ): Promise<T> {
    const t0 = performance.now();
    const before = { ...this.budget.snapshot(), llmCalls: this.llmCalls, retries: this.retries };
    const record = (o: TraceStepOutcome) => {
      const after = this.budget.snapshot();
      this.recordStep({
        name,
        kind,
        durationMs: Math.round(performance.now() - t0),
        llmCalls: this.llmCalls - before.llmCalls,
        toolCalls: after.toolCalls - before.toolCalls,
        inputTokens: after.inputTokens - before.inputTokens,
        outputTokens: after.outputTokens - before.outputTokens,
        retries: this.retries - before.retries,
        ...o,
      });
    };
    let result: T;
    try {
      result = await fn();
    } catch (e) {
      record({ status: 'error', detail: 'EXCEPTION' });
      throw e;
    }
    record(outcome(result));
    return result;
  }

  recordStep(step: TraceStep): void {
    this.steps.push(step);
    if (this.echo) console.log(`[${this.runId}] step ${step.name}`, step.status, `${step.durationMs}ms`);
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
      steps: [...this.steps],
    };
  }
}
