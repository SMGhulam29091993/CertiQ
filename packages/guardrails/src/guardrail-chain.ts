import type { ChainOutcome, GuardrailStepRecord, IGuardrail, IGuardrailChain } from '@certiq/contracts';

/**
 * Runs guardrails in order. A `transform` passes its new value to the next guardrail;
 * the first `block` short-circuits. Open/Closed: new guardrails are added at the
 * composition root, never by editing this class.
 */
export class GuardrailChain<T> implements IGuardrailChain<T> {
  constructor(private readonly guardrails: readonly IGuardrail<T>[]) {}

  async run(input: T): Promise<ChainOutcome<T>> {
    let value = input;
    const applied: string[] = [];
    const steps: GuardrailStepRecord[] = [];
    for (const g of this.guardrails) {
      // performance.now(): guardrails are regex/arithmetic and finish well under 1 ms, which Date.now() rounds to 0.
      const t0 = performance.now();
      const verdict = await g.check(value);
      const durationMs = round(performance.now() - t0);
      if (verdict.action === 'block') {
        steps.push({ id: g.id, action: 'block', durationMs, reason: verdict.reason });
        return { blocked: true, by: g.id, reason: verdict.reason, userMessage: verdict.userMessage, applied, steps };
      }
      steps.push({ id: g.id, action: verdict.action, durationMs, ...(verdict.action === 'transform' ? { reason: verdict.reason } : {}) });
      applied.push(verdict.action === 'transform' ? `${g.id}:transformed` : g.id);
      if (verdict.action === 'transform') value = verdict.value;
    }
    return { blocked: false, value, applied, steps };
  }
}

function round(ms: number): number {
  return Math.round(ms * 100) / 100;
}
