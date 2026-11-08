import {
  err,
  ok,
  type ILLMProvider,
  type LLMRequest,
  type LLMResponse,
  type Result,
} from '@certiq/contracts';

export type FakeStep = Omit<LLMResponse, 'model' | 'tier' | 'usage'> & { usage?: LLMResponse['usage'] };

/**
 * Deterministic stand-in for tests (Liskov: substitutable for AnthropicProvider).
 * Returns scripted responses in order and records every request for assertions.
 */
export class ScriptedFakeProvider implements ILLMProvider {
  readonly requests: LLMRequest[] = [];
  private cursor = 0;

  constructor(private readonly script: readonly FakeStep[]) {}

  async complete(request: LLMRequest): Promise<Result<LLMResponse>> {
    this.requests.push(request);
    const step = this.script[this.cursor++];
    if (!step) return err('LLM_ERROR', `ScriptedFakeProvider ran out of steps at call ${this.cursor}.`);
    return ok({
      ...step,
      usage: step.usage ?? { inputTokens: 100, outputTokens: 50 },
      model: `fake-${request.tier}`,
      tier: request.tier,
    });
  }
}
