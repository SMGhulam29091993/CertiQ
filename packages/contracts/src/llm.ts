import type { Result } from './result';

/**
 * Provider-neutral LLM contract. Agents depend on this, never on a vendor SDK —
 * swapping Claude for another provider is a new class in packages/llm, nothing else.
 */

export type ModelTier = 'fast' | 'strong';

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  /** JSON Schema for the tool input. */
  readonly inputSchema: Record<string, unknown>;
}

export type LLMContentBlock =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'tool_use'; readonly id: string; readonly name: string; readonly input: unknown }
  | {
      readonly type: 'tool_result';
      readonly toolUseId: string;
      readonly content: string;
      readonly isError?: boolean;
    };

export interface LLMMessage {
  readonly role: 'user' | 'assistant';
  readonly content: readonly LLMContentBlock[];
}

export interface LLMRequest {
  readonly tier: ModelTier;
  readonly system: string;
  readonly messages: readonly LLMMessage[];
  readonly tools?: readonly ToolDefinition[];
  readonly maxTokens: number;
  readonly temperature?: number;
}

export interface LLMUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface LLMResponse {
  readonly content: readonly LLMContentBlock[];
  readonly stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'other';
  readonly usage: LLMUsage;
  readonly model: string;
  readonly tier: ModelTier;
}

export interface ILLMProvider {
  complete(request: LLMRequest): Promise<Result<LLMResponse>>;
}
