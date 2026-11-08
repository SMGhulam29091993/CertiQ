import {
  NotImplementedError,
  type GuardrailVerdict,
  type IOutputGuardrail,
  type OutputGuardrailInput,
} from '@certiq/contracts';

/**
 * LIVE BUILD — answer-guardrails.T04 (see .ai-context/specs/answer-guardrails.spec.md AC3–AC5).
 *
 * Contract:
 *  - Every figure.value must equal (within tolerance) a non-suppressed row value in
 *    the evidence for the same metricId, or a sum of such values when the figure is a total.
 *  - Every number written in answer.summary must match some figure (after unit
 *    formatting: $1,234.56 / 12.3% / 1,234) — numbers in prose are the classic leak.
 *  - Suppressed rows never ground a number.
 *  - Deterministic code only. No LLM call in this guardrail.
 */
export class NumericGroundingGuardrail implements IOutputGuardrail {
  readonly id = 'output.numeric_grounding';
  readonly stage = 'output' as const;

  constructor(private readonly relativeTolerance = 0.005) {}

  async check(_input: OutputGuardrailInput): Promise<GuardrailVerdict<OutputGuardrailInput>> {
    void this.relativeTolerance;
    throw new NotImplementedError('answer-guardrails.T04');
  }
}
