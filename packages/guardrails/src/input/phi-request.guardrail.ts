import type { GuardrailVerdict, IInputGuardrail, InputGuardrailInput } from '@certiq/contracts';

/**
 * Blocks requests for individual-patient information. CertiQ answers aggregate
 * business questions only. Deterministic on purpose: this decision must not depend
 * on a model's mood. False positives are acceptable; false negatives are not.
 */
const PATTERNS: readonly RegExp[] = [
  /\bpatient(s)?\s+(named|called)\b/i,
  /\b(which|list|show|name|identify|find)\s+(me\s+)?(the\s+)?(specific\s+|individual\s+)?patients\b/i,
  /\bpatient\s*(id|#|number)\s*[:#]?\s*\d+/i,
  /\b(ssn|social security|date of birth|dob|home address|phone number|email address|medical record)\b/i,
  /\b(who|whom)\s+(exactly\s+)?(ordered|bought|was prescribed|got)\b/i,
];

export class PhiRequestGuardrail implements IInputGuardrail {
  readonly id = 'input.phi_request';
  readonly stage = 'input' as const;

  async check(input: InputGuardrailInput): Promise<GuardrailVerdict<InputGuardrailInput>> {
    const hit = PATTERNS.find((p) => p.test(input.question));
    if (!hit) return { action: 'allow' };
    return {
      action: 'block',
      reason: `matched PHI pattern ${hit.source}`,
      userMessage:
        'I can only answer aggregate business questions. I can’t look up or identify individual patients.',
    };
  }
}
