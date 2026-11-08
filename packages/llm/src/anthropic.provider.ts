import Anthropic from '@anthropic-ai/sdk';
import {
  err,
  ok,
  type ILLMProvider,
  type LLMContentBlock,
  type LLMRequest,
  type LLMResponse,
  type ModelTier,
  type Result,
} from '@certiq/contracts';

export interface AnthropicProviderConfig {
  readonly apiKey: string;
  readonly models: Readonly<Record<ModelTier, string>>;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
}

/**
 * Adapter: provider-neutral LLMRequest ⇄ Anthropic Messages API.
 * All vendor types stay inside this file (Dependency Inversion).
 */
export class AnthropicProvider implements ILLMProvider {
  private readonly client: Anthropic;

  constructor(private readonly config: AnthropicProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeoutMs ?? 60_000,
      maxRetries: config.maxRetries ?? 2,
    });
  }

  async complete(request: LLMRequest): Promise<Result<LLMResponse>> {
    const model = this.config.models[request.tier];
    try {
      const res = await this.client.messages.create({
        model,
        max_tokens: request.maxTokens,
        system: request.system,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        messages: request.messages.map((m) => ({ role: m.role, content: m.content.map(toAnthropicBlock) })),
        ...(request.tools && request.tools.length > 0
          ? {
              tools: request.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
              })),
            }
          : {}),
      });

      const content: LLMContentBlock[] = [];
      for (const block of res.content) {
        if (block.type === 'text') content.push({ type: 'text', text: block.text });
        else if (block.type === 'tool_use') content.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input });
      }

      return ok({
        content,
        stopReason:
          res.stop_reason === 'end_turn' || res.stop_reason === 'tool_use' || res.stop_reason === 'max_tokens'
            ? res.stop_reason
            : 'other',
        usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
        model: res.model,
        tier: request.tier,
      });
    } catch (e) {
      const status = e instanceof Anthropic.APIError ? e.status : undefined;
      return err('LLM_ERROR', `LLM call failed (${model}).`, { status, message: (e as Error).message });
    }
  }
}

function toAnthropicBlock(block: LLMContentBlock): Anthropic.ContentBlockParam {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text };
    case 'tool_use':
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
    case 'tool_result':
      return {
        type: 'tool_result',
        tool_use_id: block.toolUseId,
        content: block.content,
        ...(block.isError ? { is_error: true } : {}),
      };
  }
}
