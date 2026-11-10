import { describe, expect, it } from 'vitest';
import {
  err,
  ok,
  type AnalystAnswer,
  type AnalystRun,
  type AuditVerdict,
  type ChainOutcome,
  type IAnalystAgent,
  type IAuditorAgent,
  type IGuardrailChain,
  type IMetricTool,
  type MetricResult,
  type Result,
} from '@certiq/contracts';
import { ScriptedFakeProvider } from '@certiq/llm';
import { AnalystAgent } from '../analyst/analyst.agent';
import { AuditorAgent } from '../auditor/auditor.agent';
import { RunContextFactory } from '../runtime/run-context-factory';
import { Orchestrator, type OrchestratorDeps } from './orchestrator';

const answer: AnalystAnswer = {
  status: 'answered',
  summary: '4,321 orders were completed in October 2026.',
  figures: [{ label: 'Orders', value: 4321, unit: 'count', metricId: 'completed_orders', metricVersion: '1.0.0', period: '2026-10' }],
  suggestedMetrics: [],
};

const allow = <T>(id: string): IGuardrailChain<T> => ({
  run: async (value: T): Promise<ChainOutcome<T>> => ({
    blocked: false,
    value,
    applied: [id],
    steps: [{ id, action: 'allow', durationMs: 0.1 }],
  }),
});
const block = <T>(id: string): IGuardrailChain<T> => ({
  run: async (): Promise<ChainOutcome<T>> => ({
    blocked: true,
    by: id,
    reason: 'internal',
    userMessage: 'safe',
    applied: [id],
    steps: [{ id, action: 'block', durationMs: 0.2, reason: 'internal' }],
  }),
});

const evidence: MetricResult = {
  metricId: 'completed_orders',
  metricVersion: '1.0.0',
  registryVersion: '1.0.0',
  unit: 'count',
  query: { metric: 'completed_orders', dimensions: [], filters: {}, time_range: { start: '2026-10-01', end: '2026-11-01' }, limit: 100 },
  rows: [{ period: null, dimensions: {}, value: 4321, patientCount: 900, suppressed: false }],
  suppressedRows: 0,
  sql: 'SELECT …',
  params: [],
  executedAt: '2026-11-08T00:00:00Z',
  durationMs: 2,
};
const tool: IMetricTool = {
  name: 'query_certified_metric',
  definition: () => ({ name: 'query_certified_metric', description: 'fake', inputSchema: { type: 'object' } }),
  run: async () => ok(evidence),
};
const text = (t: string) => ({ stopReason: 'end_turn' as const, content: [{ type: 'text' as const, text: t }] });

const analyst = (r: Result<AnalystRun>): IAnalystAgent & { calls: number } => {
  const a = { calls: 0, answer: async () => (a.calls++, r) };
  return a;
};
const auditor = (r: Result<AuditVerdict>): IAuditorAgent & { calls: number } => {
  const a = { calls: 0, audit: async () => (a.calls++, r) };
  return a;
};

const deps = (over: Partial<OrchestratorDeps> = {}): OrchestratorDeps => ({
  inputGuardrails: allow('input.all'),
  analyst: analyst(ok({ answer, evidence: [], toolCalls: 1 })),
  outputGuardrails: allow('output.all'),
  auditor: auditor(ok({ pass: true, issues: [] })),
  contexts: new RunContextFactory({ maxToolCalls: 4, maxInputTokens: 40_000, maxOutputTokens: 4_000, maxUsd: null }, { fast: null, strong: null }),
  ...over,
});

describe('Orchestrator', () => {
  it('analyst-auditor-agents.UT06 — output guardrail block → blocked with blockedBy, auditor not called', async () => {
    const aud = auditor(ok({ pass: true, issues: [] }));
    const res = await new Orchestrator(deps({ outputGuardrails: block('output.numeric_grounding'), auditor: aud })).ask('q');

    expect(res.status).toBe('blocked');
    expect(res.blockedBy).toEqual({ guardrail: 'output.numeric_grounding', reason: 'internal' });
    expect(res.userMessage).toBe('safe');
    expect(res.answer).toBeUndefined(); // a blocked number is never shown
    expect(aud.calls).toBe(0);
    expect(res.guardrailsApplied).toEqual(['input.all', 'output.numeric_grounding']);
    expect(res.trace.steps.map((s) => [s.name, s.status])).toEqual([
      ['input.all', 'allowed'],
      ['analyst', 'answered'],
      ['output.numeric_grounding', 'blocked'],
    ]);
    expect(res.trace.steps[2]).toMatchObject({ kind: 'guardrail', detail: 'internal', retries: 0, toolCalls: 0 });
  });

  it('AC9 — input block stops before the analyst runs', async () => {
    const an = analyst(ok({ answer, evidence: [], toolCalls: 0 }));
    const res = await new Orchestrator(deps({ inputGuardrails: block('input.phi_request'), analyst: an })).ask('q');
    expect(res.status).toBe('blocked');
    expect(res.blockedBy?.guardrail).toBe('input.phi_request');
    expect(an.calls).toBe(0);
    expect(res.trace.steps).toEqual([
      expect.objectContaining({ name: 'input.phi_request', kind: 'guardrail', status: 'blocked' }),
    ]);
  });

  it('AC9 — audit failure → blocked by auditor', async () => {
    const res = await new Orchestrator(
      deps({ auditor: auditor(ok({ pass: false, issues: [{ severity: 'blocker', message: 'wrong period' }] })) }),
    ).ask('q');
    expect(res.status).toBe('blocked');
    expect(res.blockedBy).toEqual({ guardrail: 'auditor', reason: 'wrong period' });
    expect(res.answer).toBeUndefined(); // the console renders answer.figures; a failed number is never shown
    expect(res.audit?.issues).toHaveLength(1);
    expect(res.trace.steps.at(-1)).toMatchObject({ name: 'auditor', kind: 'agent', status: 'failed' });
  });

  it('AC6/AC9 — real AuditorAgent overrides pass:true with a blocker → blocked, answer not shown as answered', async () => {
    const llm = new ScriptedFakeProvider([
      { stopReason: 'end_turn', content: [{ type: 'text', text: '{"pass":true,"issues":[{"severity":"blocker","message":"wrong period"}]}' }] },
    ]);
    const res = await new Orchestrator(deps({ auditor: new AuditorAgent(llm, { systemPrompt: 'audit', maxTokens: 800 }) })).ask('q');
    expect(res.status).toBe('blocked');
    expect(res.blockedBy).toEqual({ guardrail: 'auditor', reason: 'wrong period' });
    expect(res.audit?.pass).toBe(false);
    expect(res.answer).toBeUndefined();
    expect(res.userMessage).not.toBe(answer.summary);
  });

  it('AC7 — real AuditorAgent with unparseable output twice → error, no answer', async () => {
    const prose = { stopReason: 'end_turn' as const, content: [{ type: 'text' as const, text: 'looks fine to me' }] };
    const llm = new ScriptedFakeProvider([prose, prose]);
    const res = await new Orchestrator(deps({ auditor: new AuditorAgent(llm, { systemPrompt: 'audit', maxTokens: 800 }) })).ask('q');
    expect(res.status).toBe('error');
    expect(res.answer).toBeUndefined();
    expect(llm.requests).toHaveLength(2);
  });

  it('AC8 — analyst BUDGET_EXCEEDED → error', async () => {
    const res = await new Orchestrator(deps({ analyst: analyst(err('BUDGET_EXCEEDED', 'tool calls 5 > 4')) })).ask('q');
    expect(res.status).toBe('error');
    // The reason is in the trace, on the step that ran out.
    expect(res.trace.steps.map((s) => s.name)).toEqual(['input.all', 'analyst']);
    expect(res.trace.steps[1]).toMatchObject({ status: 'error', detail: 'BUDGET_EXCEEDED: tool calls 5 > 4' });
  });

  it('AC8 — real analyst over the tool budget → error step carries the reason and counts every call', async () => {
    const use = { stopReason: 'tool_use' as const, content: [{ type: 'tool_use' as const, id: 't', name: 'query_certified_metric', input: {} }] };
    const llm = new ScriptedFakeProvider([use, use, use, use, use]);
    const an = new AnalystAgent(llm, tool, { systemPrompt: 'x', maxTokensPerCall: 500, today: () => '2026-11-10' });
    const res = await new Orchestrator(deps({ analyst: an })).ask('q');
    expect(res.status).toBe('error');
    expect(res.trace.steps[1]).toMatchObject({ name: 'analyst', status: 'error', toolCalls: 5, llmCalls: 5 });
    expect(res.trace.steps[1]?.detail).toMatch(/^BUDGET_EXCEEDED: tool calls 5 > 4/);
  });

  it('AC7 — unreadable audit fails closed', async () => {
    const res = await new Orchestrator(deps({ auditor: auditor(err('AUDIT_FAILED', 'x')) })).ask('q');
    expect(res.status).toBe('error');
    expect(res.answer).toBeUndefined();
  });

  it('refusals skip output guardrails and audit', async () => {
    const aud = auditor(ok({ pass: true, issues: [] }));
    const refused: AnalystAnswer = { status: 'refused', summary: 'Not certified.', figures: [], refusalReason: 'not_certified', suggestedMetrics: ['x'] };
    const res = await new Orchestrator(deps({ analyst: analyst(ok({ answer: refused, evidence: [], toolCalls: 0 })), auditor: aud })).ask('q');
    expect(res.status).toBe('refused');
    expect(aud.calls).toBe(0);
    expect(res.trace.steps.map((s) => [s.name, s.status])).toEqual([
      ['input.all', 'allowed'],
      ['analyst', 'refused'],
    ]);
  });

  it('AC10 — answered response carries guardrailsApplied and a trace summary', async () => {
    const res = await new Orchestrator(deps()).ask('q');
    expect(res.status).toBe('answered');
    expect(res.guardrailsApplied).toEqual(['input.all', 'output.all', 'auditor']);
    // Fake agents make no LLM calls, so cost stays 0 (it only turns null once an unpriced call is charged).
    expect(res.trace).toMatchObject({ llmCalls: 0, toolCalls: 0 });
    expect(res.trace).toHaveProperty('costUsd');
    expect(typeof res.trace.durationMs).toBe('number');
  });

  it('a thrown bug becomes status error, not a crash', async () => {
    const broken: IAnalystAgent = { answer: async () => { throw new Error('boom'); } };
    const res = await new Orchestrator(deps({ analyst: broken })).ask('q');
    expect(res.status).toBe('error');
    expect(res.trace.steps.at(-1)).toMatchObject({ name: 'analyst', status: 'error', detail: 'EXCEPTION' });
  });

  it('AC10 — each step records duration, LLM/tool calls, tokens, retries and status, in order', async () => {
    const analystLlm = new ScriptedFakeProvider([
      { stopReason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'query_certified_metric', input: {} }], usage: { inputTokens: 300, outputTokens: 40 } },
      { ...text('4,321 orders'), usage: { inputTokens: 350, outputTokens: 30 } }, // not JSON → one repair
      { ...text(JSON.stringify(answer)), usage: { inputTokens: 400, outputTokens: 60 } },
    ]);
    const auditorLlm = new ScriptedFakeProvider([
      { ...text('{"pass":true,"issues":[]}'), usage: { inputTokens: 500, outputTokens: 20 } },
    ]);
    const res = await new Orchestrator(
      deps({
        analyst: new AnalystAgent(analystLlm, tool, { systemPrompt: 'x', maxTokensPerCall: 500, today: () => '2026-11-10' }),
        auditor: new AuditorAgent(auditorLlm, { systemPrompt: 'audit', maxTokens: 800 }),
      }),
    ).ask('q');

    expect(res.status).toBe('answered');
    const [inp, an, out, aud, ...rest] = res.trace.steps;
    expect(rest).toEqual([]);
    expect(inp).toMatchObject({ name: 'input.all', kind: 'guardrail', status: 'allowed', llmCalls: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0, retries: 0 });
    expect(an).toMatchObject({ name: 'analyst', kind: 'agent', status: 'answered', llmCalls: 3, toolCalls: 1, inputTokens: 1050, outputTokens: 130, retries: 1 });
    expect(out).toMatchObject({ name: 'output.all', kind: 'guardrail', status: 'allowed' });
    expect(aud).toMatchObject({ name: 'auditor', kind: 'agent', status: 'passed', llmCalls: 1, toolCalls: 0, inputTokens: 500, outputTokens: 20, retries: 0 });
    for (const s of res.trace.steps) expect(s.durationMs).toBeGreaterThanOrEqual(0);
    // Per-step usage adds up to the run totals: nothing is counted twice or dropped.
    expect(res.trace.steps.reduce((n, s) => n + s.inputTokens, 0)).toBe(res.trace.inputTokens);
    expect(res.trace.steps.reduce((n, s) => n + s.llmCalls, 0)).toBe(res.trace.llmCalls);
  });

  it('AC10 — an auditor repair turn is counted as one retry', async () => {
    const llm = new ScriptedFakeProvider([text('looks fine'), text('{"pass":true,"issues":[]}')]);
    const res = await new Orchestrator(deps({ auditor: new AuditorAgent(llm, { systemPrompt: 'audit', maxTokens: 800 }) })).ask('q');
    expect(res.status).toBe('answered');
    expect(res.trace.steps.at(-1)).toMatchObject({ name: 'auditor', status: 'passed', llmCalls: 2, retries: 1 });
  });

  it('AC10 — guardrail chain steps are recorded one per guardrail, with transform status', async () => {
    const chain: IGuardrailChain<{ question: string }> = {
      run: async (value) => ({
        blocked: false,
        value,
        applied: ['input.max_length', 'input.x:transformed'],
        steps: [
          { id: 'input.max_length', action: 'allow', durationMs: 0.05 },
          { id: 'input.x', action: 'transform', durationMs: 0.07, reason: 'trimmed' },
        ],
      }),
    };
    const res = await new Orchestrator(deps({ inputGuardrails: chain })).ask('q');
    expect(res.trace.steps.slice(0, 2)).toEqual([
      expect.objectContaining({ name: 'input.max_length', status: 'allowed', durationMs: 0.05 }),
      expect.objectContaining({ name: 'input.x', status: 'transformed', durationMs: 0.07 }),
    ]);
    expect(res.trace.steps[1]).not.toHaveProperty('detail');
  });
});
