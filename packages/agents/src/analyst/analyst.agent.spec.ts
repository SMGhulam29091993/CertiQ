import { describe, expect, it } from 'vitest';
import { err, ok, type IMetricTool, type MetricResult, type Result } from '@certiq/contracts';
import { ScriptedFakeProvider, type FakeStep } from '@certiq/llm';
import { RunContextFactory } from '../runtime/run-context-factory';
import { AnalystAgent } from './analyst.agent';

const result: MetricResult = {
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

class FakeTool implements IMetricTool {
  readonly name = 'query_certified_metric';
  readonly inputs: unknown[] = [];
  constructor(private readonly reply: () => Result<MetricResult>) {}
  definition() {
    return { name: this.name, description: 'fake', inputSchema: { type: 'object' } };
  }
  async run(input: unknown) {
    this.inputs.push(input);
    return this.reply();
  }
}

const toolUse = (id: string): FakeStep => ({
  stopReason: 'tool_use',
  content: [{ type: 'tool_use', id, name: 'query_certified_metric', input: { metric: 'completed_orders' } }],
});
const final = (json: object): FakeStep => ({ stopReason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(json) }] });

const answered = {
  status: 'answered',
  summary: '4,321 orders were completed in October 2026.',
  figures: [{ label: 'Completed orders', value: 4321, unit: 'count', metricId: 'completed_orders', metricVersion: '1.0.0', period: '2026-10' }],
};

const ctx = (maxToolCalls = 4) =>
  new RunContextFactory(
    { maxToolCalls, maxInputTokens: 40_000, maxOutputTokens: 4_000, maxUsd: null },
    { fast: null, strong: null },
  ).create();

const agent = (llm: ScriptedFakeProvider, tool: IMetricTool) =>
  new AnalystAgent(llm, tool, { systemPrompt: 'Today is {{today}}.', maxTokensPerCall: 1500, today: () => '2026-11-08' });

describe('AnalystAgent', () => {
  it('analyst-auditor-agents.UT01 — tool_use → result → final JSON is answered with one evidence item', async () => {
    const llm = new ScriptedFakeProvider([toolUse('t1'), final(answered)]);
    const c = ctx();
    const run = await agent(llm, new FakeTool(() => ok(result))).answer('Completed orders last month?', c);

    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.value.answer.status).toBe('answered');
    expect(run.value.evidence).toHaveLength(1);
    expect(run.value.toolCalls).toBe(1);
    expect(llm.requests[0]?.system).toBe('Today is 2026-11-08.');
    expect(llm.requests[0]?.tier).toBe('fast');
    // The question is sent once, then the tool result follows the assistant turn.
    expect(llm.requests[1]?.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(c.tracer.summary().llmCalls).toBe(2);
  });

  it('analyst-auditor-agents.UT02 — NOT_CERTIFIED goes back as isError and the model refuses', async () => {
    const llm = new ScriptedFakeProvider([
      toolUse('t1'),
      final({ status: 'refused', summary: 'Not certified.', refusalReason: 'not_certified', suggestedMetrics: ['gross_revenue_usd'] }),
    ]);
    const run = await agent(llm, new FakeTool(() => err('NOT_CERTIFIED', 'no such metric'))).answer('LTV?', ctx());

    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.value.answer.status).toBe('refused');
    expect(run.value.answer.suggestedMetrics).toEqual(['gross_revenue_usd']);
    expect(run.value.evidence).toHaveLength(0);
    const fed = llm.requests[1]?.messages.at(-1)?.content[0];
    expect(fed).toMatchObject({ type: 'tool_result', toolUseId: 't1', isError: true });
  });

  it('analyst-auditor-agents.UT03 — looping tool_use 5× with max 4 stops with BUDGET_EXCEEDED', async () => {
    const llm = new ScriptedFakeProvider([toolUse('a'), toolUse('b'), toolUse('c'), toolUse('d'), toolUse('e'), final(answered)]);
    const tool = new FakeTool(() => ok(result));
    const c = ctx(4);
    const run = await agent(llm, tool).answer('loop', c);

    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.error.code).toBe('BUDGET_EXCEEDED');
    expect(tool.inputs).toHaveLength(4); // the 5th call is refused before it reaches the tool
    expect(c.tracer.summary().events.some((e) => e.name === 'budget.exceeded')).toBe(true);
  });

  it('repairs one malformed final message, then succeeds', async () => {
    const llm = new ScriptedFakeProvider([{ stopReason: 'end_turn', content: [{ type: 'text', text: 'Sure! 4,321.' }] }, final(answered)]);
    const run = await agent(llm, new FakeTool(() => ok(result))).answer('q', ctx());
    expect(run.ok).toBe(true);
    expect(llm.requests[1]?.tools).toBeUndefined();
  });

  it('fails loudly after a second malformed final message', async () => {
    const bad: FakeStep = { stopReason: 'max_tokens', content: [{ type: 'text', text: '{"status":"answ' }] };
    const run = await agent(new ScriptedFakeProvider([bad, bad]), new FakeTool(() => ok(result))).answer('q', ctx());
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.error.code).toBe('LLM_ERROR');
  });

  it('counts every tool_use in one turn against the budget', async () => {
    const multi: FakeStep = {
      stopReason: 'tool_use',
      content: ['x', 'y', 'z'].map((id) => ({ type: 'tool_use' as const, id, name: 'query_certified_metric', input: {} })),
    };
    const run = await agent(new ScriptedFakeProvider([multi, final(answered)]), new FakeTool(() => ok(result))).answer('q', ctx(2));
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.error.code).toBe('BUDGET_EXCEEDED');
  });
});
