import {
  AnalystAnswerSchema,
  err,
  ok,
  type AnalystAnswer,
  type AnalystRun,
  type IAnalystAgent,
  type ILLMProvider,
  type IMetricTool,
  type LLMContentBlock,
  type LLMMessage,
  type LLMResponse,
  type MetricResult,
  type Result,
  type RunContext,
} from '@certiq/contracts';

export interface AnalystAgentOptions {
  readonly systemPrompt: string;
  readonly maxTokensPerCall: number;
  /** Injected so "last month" is deterministic in evals. */
  readonly today: () => string;
}

const REPAIR_INSTRUCTION =
  'Your last message was not a valid AnalystAnswer JSON object. Reply again with ONLY the JSON object ' +
  '(no prose, no code fences) matching the Output section of your instructions. Do not call the tool.';

/**
 * analyst-auditor-agents.T02 (spec AC1–AC4, AC8).
 *
 * Loop: fast-tier call → tool_use blocks run through the certified tool (errors fed back as
 * isError so the model can correct once or refuse) → repeat until a turn with no tool_use,
 * which must parse as AnalystAnswer (one repair turn, then fail). The budget is checked after
 * every LLM and every tool call; the budget, not a turn counter, is what bounds the loop.
 * Never: compute numbers, write SQL, or see the registry/compiler/repository directly.
 */
export class AnalystAgent implements IAnalystAgent {
  constructor(
    private readonly llm: ILLMProvider,
    private readonly tool: IMetricTool,
    private readonly options: AnalystAgentOptions,
  ) {}

  async answer(question: string, ctx: RunContext): Promise<Result<AnalystRun>> {
    const system = this.options.systemPrompt.replaceAll('{{today}}', this.options.today());
    const tools = [this.tool.definition()];
    const messages: LLMMessage[] = [{ role: 'user', content: [{ type: 'text', text: question }] }];
    const evidence: MetricResult[] = [];
    let toolCalls = 0;
    let repaired = false;

    for (;;) {
      // Tools stay defined on the repair turn too: once the history holds tool_use/tool_result
      // blocks, the Anthropic API rejects a request without `tools`, so dropping them would turn
      // every post-tool repair into an LLM_ERROR. A tool call during repair is refused below.
      const call = await this.callLLM(ctx, { system, messages, tools });
      if (!call.ok) return call;
      const response = call.value;
      messages.push({ role: 'assistant', content: response.content });

      const toolUses = response.content.filter(
        (b): b is Extract<LLMContentBlock, { type: 'tool_use' }> => b.type === 'tool_use',
      );

      if (toolUses.length > 0 && repaired) {
        // The repair turn exists to reformat an answer, not to fetch new data. More tool calls
        // here would mean the earlier "final" answer wasn't grounded in anything.
        ctx.tracer.event('analyst.parse_failed', { reason: 'tool_use during repair turn', repaired: true });
        return err('LLM_ERROR', 'Analyst called the tool during the repair turn instead of answering.');
      }

      if (toolUses.length === 0) {
        const parsed = parseAnswer(response);
        if (parsed.ok) {
          const ungrounded = provenanceProblem(parsed.value, evidence);
          if (ungrounded) {
            // AC1. Not repairable: asking again would just invite a different invented number.
            ctx.tracer.event('analyst.ungrounded', { reason: ungrounded });
            return err('LLM_ERROR', `Analyst answer not backed by this run's tool results: ${ungrounded}`);
          }
          return ok({ answer: parsed.value, evidence, toolCalls });
        }
        if (repaired) {
          ctx.tracer.event('analyst.parse_failed', { reason: parsed.reason, repaired: true });
          return err('LLM_ERROR', `Analyst answer invalid after repair: ${parsed.reason}`);
        }
        // Why one repair: a truncated or fenced reply is common and cheap to fix; a second
        // failure means the model is confused, and guessing further would hide that.
        ctx.tracer.event('analyst.repair', { reason: parsed.reason });
        repaired = true;
        messages.push({ role: 'user', content: [{ type: 'text', text: REPAIR_INSTRUCTION }] });
        continue;
      }

      // Text alongside tool_use is ignored (spec edge case); only tool results move us forward.
      const results: LLMContentBlock[] = [];
      for (const use of toolUses) {
        ctx.budget.chargeToolCall();
        toolCalls++;
        const over = ctx.budget.exceeded();
        if (over) return budgetExceeded(ctx, over);

        const run = await ctx.tracer.span('tool.query_certified_metric', () => this.tool.run(use.input));
        if (run.ok) {
          evidence.push(run.value);
          ctx.tracer.event('tool.result', {
            metricId: run.value.metricId,
            rows: run.value.rows.length,
            suppressedRows: run.value.suppressedRows,
          });
          results.push({ type: 'tool_result', toolUseId: use.id, content: JSON.stringify(toModelView(run.value)) });
        } else {
          ctx.tracer.event('tool.error', { code: run.error.code });
          results.push({
            type: 'tool_result',
            toolUseId: use.id,
            content: JSON.stringify({ error: run.error.code, message: run.error.message }),
            isError: true,
          });
        }
      }
      messages.push({ role: 'user', content: results });
    }
  }

  private async callLLM(
    ctx: RunContext,
    req: { system: string; messages: readonly LLMMessage[]; tools: readonly ReturnType<IMetricTool['definition']>[] },
  ): Promise<Result<LLMResponse>> {
    const res = await this.llm.complete({
      tier: 'fast',
      system: req.system,
      messages: [...req.messages],
      ...(req.tools.length > 0 ? { tools: req.tools } : {}),
      maxTokens: this.options.maxTokensPerCall,
      temperature: 0,
    });
    if (!res.ok) {
      ctx.tracer.event('llm.error', { agent: 'analyst', code: res.error.code });
      return err('LLM_ERROR', res.error.message);
    }
    ctx.budget.chargeLLM('fast', res.value.usage);
    // Exactly one `llm.*` event per call: InMemoryTracer counts them as llmCalls.
    ctx.tracer.event('llm.analyst', {
      stopReason: res.value.stopReason,
      inputTokens: res.value.usage.inputTokens,
      outputTokens: res.value.usage.outputTokens,
    });
    const over = ctx.budget.exceeded();
    if (over) return budgetExceeded(ctx, over);
    return res;
  }
}

function budgetExceeded(ctx: RunContext, reason: string): Result<never> {
  ctx.tracer.event('budget.exceeded', { reason });
  return err('BUDGET_EXCEEDED', reason);
}

/**
 * What the model sees of a tool result. SQL and params are for the human audit trail, not the
 * model — sending them would only invite the model to reason about SQL it may never write.
 */
function toModelView(r: MetricResult) {
  return {
    metricId: r.metricId,
    metricVersion: r.metricVersion,
    unit: r.unit,
    query: r.query,
    rows: r.rows,
    suppressedRows: r.suppressedRows,
  };
}

/**
 * AC1 at the provenance level: an `answered` answer needs at least one successful tool result
 * from this run, and every figure must cite a metric@version that was actually returned. This is
 * what turns "tool TIMEOUT → model answers anyway" into an error. Value-level matching (rounding,
 * suppressed rows, prose numbers) stays in output.numeric_grounding, so tolerance has one owner.
 */
function provenanceProblem(answer: AnalystAnswer, evidence: readonly MetricResult[]): string | null {
  if (answer.status !== 'answered') {
    // The orchestrator shows refusals and clarifications without output guardrails, so figures
    // here would reach the user unchecked.
    return answer.figures.length > 0 ? `status ${answer.status} must not carry figures` : null;
  }
  if (evidence.length === 0) return 'status answered but no tool call succeeded in this run';
  const returned = new Set(evidence.map((e) => `${e.metricId}@${e.metricVersion}`));
  const stray = [
    ...new Set(answer.figures.map((f) => `${f.metricId}@${f.metricVersion}`).filter((k) => !returned.has(k))),
  ];
  return stray.length > 0 ? `figures cite results not returned in this run: ${stray.join(', ')}` : null;
}

function parseAnswer(response: LLMResponse): { ok: true; value: AnalystAnswer } | { ok: false; reason: string } {
  if (response.stopReason === 'max_tokens') return { ok: false, reason: 'hit max_tokens mid-answer' };
  const text = response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim()
    // Tolerate a code fence despite the prompt; the content still has to be strict JSON.
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  if (text.length === 0) return { ok: false, reason: 'empty final message' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'final message is not JSON' };
  }
  const parsed = AnalystAnswerSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { ok: true, value: parsed.data };
}
