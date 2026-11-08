import type { ChainOutcome, IGuardrail, IGuardrailChain } from '@certiq/contracts';

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
    for (const g of this.guardrails) {
      const verdict = await g.check(value);
      if (verdict.action === 'block') {
        return { blocked: true, by: g.id, reason: verdict.reason, userMessage: verdict.userMessage, applied };
      }
      applied.push(verdict.action === 'transform' ? `${g.id}:transformed` : g.id);
      if (verdict.action === 'transform') value = verdict.value;
    }
    return { blocked: false, value, applied };
  }
}
