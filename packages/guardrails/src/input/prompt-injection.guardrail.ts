import type { GuardrailVerdict, IInputGuardrail, InputGuardrailInput } from '@certiq/contracts';

/**
 * Cheap first-line screen. It is NOT the main defence — the main defence is
 * structural: the model has no SQL capability and only one typed, read-only tool.
 * This guardrail exists so obvious attempts are logged and refused early.
 */
const PATTERNS: readonly RegExp[] = [
  /\bignore\s+(all\s+|any\s+)?(previous|prior|above|your)\s+(instructions|rules|prompt)/i,
  /\b(system prompt|developer message|your instructions)\b/i,
  /\byou are now\b/i,
  /\b(drop|truncate|alter)\s+table\b/i,
  /\b(delete\s+from|insert\s+into|update\s+\w+\s+set)\b/i,
  /\bselect\s+[\w*,\s]+\s+from\s+\w+/i,
];

export class PromptInjectionGuardrail implements IInputGuardrail {
  readonly id = 'input.prompt_injection';
  readonly stage = 'input' as const;

  async check(input: InputGuardrailInput): Promise<GuardrailVerdict<InputGuardrailInput>> {
    const hit = PATTERNS.find((p) => p.test(input.question));
    if (!hit) return { action: 'allow' };
    return {
      action: 'block',
      reason: `matched injection pattern ${hit.source}`,
      userMessage: 'I can only answer questions using certified metrics. Please rephrase your question.',
    };
  }
}
