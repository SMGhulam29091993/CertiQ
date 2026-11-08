import type { GuardrailVerdict, IInputGuardrail, InputGuardrailInput } from '@certiq/contracts';

export class MaxLengthGuardrail implements IInputGuardrail {
  readonly id = 'input.max_length';
  readonly stage = 'input' as const;

  constructor(private readonly maxChars = 500) {}

  async check(input: InputGuardrailInput): Promise<GuardrailVerdict<InputGuardrailInput>> {
    const q = input.question.trim();
    if (q.length === 0) {
      return { action: 'block', reason: 'empty question', userMessage: 'Please ask a question about a business metric.' };
    }
    if (q.length > this.maxChars) {
      return {
        action: 'block',
        reason: `question length ${q.length} > ${this.maxChars}`,
        userMessage: `Please keep questions under ${this.maxChars} characters.`,
      };
    }
    return { action: 'allow' };
  }
}
