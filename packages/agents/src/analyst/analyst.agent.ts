import {
  NotImplementedError,
  type AnalystRun,
  type IAnalystAgent,
  type ILLMProvider,
  type IMetricTool,
  type Result,
  type RunContext,
} from '@certiq/contracts';

export interface AnalystAgentOptions {
  readonly systemPrompt: string;
  readonly maxTokensPerCall: number;
  /** Injected so "last month" is deterministic in evals. */
  readonly today: () => string;
}

/**
 * LIVE BUILD — analyst-auditor-agents.T02 (spec AC1–AC4).
 *
 * Loop contract:
 *  1. Call llm (tier: 'fast') with the system prompt + tool definition.
 *  2. On tool_use → budget.chargeToolCall() → tool.run(input) → feed back as tool_result
 *     (errors go back with isError: true so the model can correct or refuse).
 *  3. Check ctx.budget.exceeded() after EVERY llm and tool call — stop with BUDGET_EXCEEDED.
 *  4. Final turn must be a JSON AnalystAnswer → AnalystAnswerSchema.safeParse;
 *     one repair attempt on failure, then fail loudly.
 *  5. Return evidence = every successful MetricResult from this run.
 * Never: compute numbers, write SQL, or see the registry/compiler/repository directly.
 */
export class AnalystAgent implements IAnalystAgent {
  constructor(
    private readonly llm: ILLMProvider,
    private readonly tool: IMetricTool,
    private readonly options: AnalystAgentOptions,
  ) {}

  async answer(_question: string, _ctx: RunContext): Promise<Result<AnalystRun>> {
    void this.llm;
    void this.tool;
    void this.options;
    throw new NotImplementedError('analyst-auditor-agents.T02');
  }
}
