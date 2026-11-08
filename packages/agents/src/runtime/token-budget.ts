import type { BudgetLimits, IBudget, LLMUsage, ModelTier } from '@certiq/contracts';

/** USD per million tokens. Null when not configured — cost is then reported as null, never guessed. */
export type PriceTable = Readonly<Record<ModelTier, { input: number; output: number } | null>>;

/** Per-question budget. Checked by the orchestrator/agent loop after every LLM and tool call. */
export class TokenBudget implements IBudget {
  private toolCalls = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private costUsd: number | null = 0;

  constructor(
    private readonly limits: BudgetLimits,
    private readonly prices: PriceTable,
  ) {}

  chargeLLM(tier: ModelTier, usage: LLMUsage): void {
    this.inputTokens += usage.inputTokens;
    this.outputTokens += usage.outputTokens;
    const price = this.prices[tier];
    if (price === null || this.costUsd === null) {
      this.costUsd = null;
      return;
    }
    this.costUsd += (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
  }

  chargeToolCall(): void {
    this.toolCalls++;
  }

  exceeded(): string | null {
    const l = this.limits;
    if (this.toolCalls > l.maxToolCalls) return `tool calls ${this.toolCalls} > ${l.maxToolCalls}`;
    if (this.inputTokens > l.maxInputTokens) return `input tokens ${this.inputTokens} > ${l.maxInputTokens}`;
    if (this.outputTokens > l.maxOutputTokens) return `output tokens ${this.outputTokens} > ${l.maxOutputTokens}`;
    if (l.maxUsd !== null && this.costUsd !== null && this.costUsd > l.maxUsd) {
      return `cost $${this.costUsd.toFixed(4)} > $${l.maxUsd}`;
    }
    return null;
  }

  snapshot() {
    return {
      toolCalls: this.toolCalls,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      costUsd: this.costUsd,
    };
  }
}
