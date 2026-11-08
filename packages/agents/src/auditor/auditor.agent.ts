import {
  NotImplementedError,
  type AnalystAnswer,
  type AuditVerdict,
  type IAuditorAgent,
  type ILLMProvider,
  type MetricResult,
  type Result,
  type RunContext,
} from '@certiq/contracts';

export interface AuditorAgentOptions {
  readonly systemPrompt: string;
  readonly maxTokens: number;
}

/**
 * LIVE BUILD — analyst-auditor-agents.T03 (spec AC5–AC7).
 *
 * Separate context from the analyst (it never sees the analyst's reasoning, only the
 * question, final answer and evidence). Tier: 'strong'. Checks that the narrative
 * answers the question asked, the time range matches the question, comparisons
 * are framed correctly, and caveats (suppression, partial periods) are disclosed.
 * Output: AuditVerdict JSON. It can pass or fail — it can never rewrite numbers.
 * Hard rule: any 'blocker' issue ⇒ pass=false, regardless of what the model says.
 */
export class AuditorAgent implements IAuditorAgent {
  constructor(
    private readonly llm: ILLMProvider,
    private readonly options: AuditorAgentOptions,
  ) {}

  async audit(
    _input: { question: string; answer: AnalystAnswer; evidence: readonly MetricResult[] },
    _ctx: RunContext,
  ): Promise<Result<AuditVerdict>> {
    void this.llm;
    void this.options;
    throw new NotImplementedError('analyst-auditor-agents.T03');
  }
}
