import {
  err,
  ok,
  type AnalystAnswer,
  type AuditIssue,
  type AuditVerdict,
  type IAuditorAgent,
  type ILLMProvider,
  type LLMMessage,
  type LLMResponse,
  type MetricResult,
  type Result,
  type RunContext,
} from '@certiq/contracts';

export interface AuditorAgentOptions {
  readonly systemPrompt: string;
  readonly maxTokens: number;
}

const REPAIR_INSTRUCTION =
  'Your last message was not valid. Reply with ONLY {"pass": boolean, "issues": [{"severity": "blocker"|"warning", "message": string}]}.';

/**
 * analyst-auditor-agents.T03 (spec AC5–AC7).
 *
 * Separate context from the analyst: the request is built from scratch out of question, final
 * answer and evidence only — no analyst messages, reasoning or tool blocks (AC5). Strong tier,
 * no tools. It can pass or fail, never rewrite. Any blocker forces pass=false whatever the model
 * said (AC6). Unparseable output gets one repair turn, then the audit fails closed (AC7).
 */
export class AuditorAgent implements IAuditorAgent {
  constructor(
    private readonly llm: ILLMProvider,
    private readonly options: AuditorAgentOptions,
  ) {}

  async audit(
    input: { question: string; answer: AnalystAnswer; evidence: readonly MetricResult[] },
    ctx: RunContext,
  ): Promise<Result<AuditVerdict>> {
    const payload = JSON.stringify({
      question: input.question,
      answer: input.answer,
      evidence: input.evidence.map(toAuditView),
    });
    const messages: LLMMessage[] = [{ role: 'user', content: [{ type: 'text', text: payload }] }];

    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await this.llm.complete({
        tier: 'strong',
        system: this.options.systemPrompt,
        messages: [...messages],
        maxTokens: this.options.maxTokens,
        temperature: 0,
      });
      if (!res.ok) {
        ctx.tracer.event('llm.error', { agent: 'auditor', code: res.error.code });
        return err('LLM_ERROR', res.error.message);
      }
      ctx.budget.chargeLLM('strong', res.value.usage);
      ctx.tracer.event('llm.auditor', {
        stopReason: res.value.stopReason,
        inputTokens: res.value.usage.inputTokens,
        outputTokens: res.value.usage.outputTokens,
      });
      const over = ctx.budget.exceeded();
      if (over) {
        ctx.tracer.event('budget.exceeded', { reason: over });
        return err('BUDGET_EXCEEDED', over);
      }

      const verdict = parseVerdict(res.value);
      if (verdict.ok) {
        const normalised = normalise(verdict.value);
        ctx.tracer.event('audit.verdict', {
          pass: normalised.pass,
          blockers: normalised.issues.filter((i) => i.severity === 'blocker').length,
          overridden: normalised.pass !== verdict.value.pass,
        });
        return ok(normalised);
      }
      ctx.tracer.event('auditor.parse_failed', { reason: verdict.reason, attempt });
      messages.push({ role: 'assistant', content: res.value.content });
      messages.push({ role: 'user', content: [{ type: 'text', text: REPAIR_INSTRUCTION }] });
    }
    // Fail closed: an audit we can't read is not an audit that passed.
    return err('AUDIT_FAILED', 'Auditor output unparseable after one repair attempt.');
  }
}

/** The auditor checks meaning, so it gets the query and rows — not SQL text or timings. */
function toAuditView(r: MetricResult) {
  return {
    metricId: r.metricId,
    metricVersion: r.metricVersion,
    unit: r.unit,
    query: r.query,
    rows: r.rows.map((row) => ({ period: row.period, dimensions: row.dimensions, value: row.value, suppressed: row.suppressed })),
    suppressedRows: r.suppressedRows,
  };
}

function normalise(v: AuditVerdict): AuditVerdict {
  const hasBlocker = v.issues.some((i) => i.severity === 'blocker');
  return { pass: v.pass && !hasBlocker, issues: v.issues };
}

function parseVerdict(response: LLMResponse): { ok: true; value: AuditVerdict } | { ok: false; reason: string } {
  if (response.stopReason === 'max_tokens') return { ok: false, reason: 'hit max_tokens' };
  const text = response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not JSON' };
  }
  if (typeof json !== 'object' || json === null) return { ok: false, reason: 'not an object' };
  const { pass, issues } = json as { pass?: unknown; issues?: unknown };
  if (typeof pass !== 'boolean') return { ok: false, reason: 'pass is not a boolean' };
  if (!Array.isArray(issues)) return { ok: false, reason: 'issues is not an array' };
  const parsed: AuditIssue[] = [];
  for (const i of issues) {
    const { severity, message } = (i ?? {}) as { severity?: unknown; message?: unknown };
    if ((severity !== 'blocker' && severity !== 'warning') || typeof message !== 'string') {
      return { ok: false, reason: 'malformed issue' };
    }
    parsed.push({ severity, message });
  }
  return { ok: true, value: { pass, issues: parsed } };
}
