import { randomUUID } from 'node:crypto';
import type { BudgetLimits, IRunContextFactory, RunContext } from '@certiq/contracts';
import { InMemoryTracer } from './in-memory-tracer';
import { TokenBudget, type PriceTable } from './token-budget';

/** Fresh tracer + budget per question, so one run can never spend another's budget. */
export class RunContextFactory implements IRunContextFactory {
  constructor(
    private readonly limits: BudgetLimits,
    private readonly prices: PriceTable,
    private readonly echo = false,
  ) {}

  create(): RunContext {
    const runId = randomUUID().slice(0, 8);
    const budget = new TokenBudget(this.limits, this.prices);
    return { runId, budget, tracer: new InMemoryTracer(runId, budget, this.echo) };
  }
}
