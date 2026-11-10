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
const notJson: FakeStep = { stopReason: 'end_turn', content: [{ type: 'text', text: 'Sure! 4,321 orders.' }] };

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

  it('repairs one malformed final message after a tool call, keeping tools defined', async () => {
    const llm = new ScriptedFakeProvider([toolUse('t1'), notJson, final(answered)]);
    const run = await agent(llm, new FakeTool(() => ok(result))).answer('q', ctx());
    expect(run.ok).toBe(true);
    // The history holds tool_use/tool_result blocks; the real API rejects such a request without tools.
    expect(llm.requests[2]?.tools).toHaveLength(1);
    expect(llm.requests[2]?.messages.at(-1)?.content[0]).toMatchObject({ type: 'text' });
  });

  it('truncated (max_tokens) JSON twice fails with LLM_ERROR', async () => {
    const bad: FakeStep = { stopReason: 'max_tokens', content: [{ type: 'text', text: '{"status":"answ' }] };
    const run = await agent(new ScriptedFakeProvider([bad, bad]), new FakeTool(() => ok(result))).answer('q', ctx());
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.error.code).toBe('LLM_ERROR');
  });

  it('a tool call during the repair turn fails instead of looping', async () => {
    const tool = new FakeTool(() => ok(result));
    const run = await agent(new ScriptedFakeProvider([notJson, toolUse('t1'), final(answered)]), tool).answer('q', ctx());
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.error.code).toBe('LLM_ERROR');
    expect(tool.inputs).toHaveLength(0);
  });

  it('a refusal carrying figures is rejected (it would bypass output guardrails)', async () => {
    const bogus = { ...answered, status: 'refused', refusalReason: 'not_certified' };
    const run = await agent(new ScriptedFakeProvider([final(bogus)]), new FakeTool(() => ok(result))).answer('q', ctx());
    expect(run.ok).toBe(false);
  });

  it('a figure citing a metric the run never returned is rejected', async () => {
    const stray = { ...answered, figures: [{ ...answered.figures[0], metricId: 'gross_revenue_usd' }] };
    const run = await agent(new ScriptedFakeProvider([toolUse('t1'), final(stray)]), new FakeTool(() => ok(result))).answer('q', ctx());
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.error.message).toContain('gross_revenue_usd@1.0.0');
  });

  describe('failure paths end in an error, never a made-up answer', () => {
    it('tool returns TIMEOUT → isError fed back → model answers anyway → LLM_ERROR', async () => {
      const llm = new ScriptedFakeProvider([toolUse('t1'), final(answered)]);
      const c = ctx();
      const run = await agent(llm, new FakeTool(() => err('TIMEOUT', 'Query exceeded 5000ms.'))).answer('Completed orders last month?', c);

      expect(llm.requests[1]?.messages.at(-1)?.content[0]).toMatchObject({ type: 'tool_result', toolUseId: 't1', isError: true });
      expect(run.ok).toBe(false);
      if (run.ok) return;
      expect(run.error.code).toBe('LLM_ERROR');
      expect(c.tracer.summary().events.map((e) => e.name)).toEqual(expect.arrayContaining(['tool.error', 'analyst.ungrounded']));
    });

    it('model returns invalid JSON twice → one repair, then LLM_ERROR', async () => {
      const llm = new ScriptedFakeProvider([toolUse('t1'), notJson, notJson, final(answered)]);
      const c = ctx();
      const run = await agent(llm, new FakeTool(() => ok(result))).answer('q', c);

      expect(run.ok).toBe(false);
      if (run.ok) return;
      expect(run.error.code).toBe('LLM_ERROR');
      expect(llm.requests).toHaveLength(3); // tool turn, first answer, one repair — the 4th step is never used
      expect(c.tracer.summary().events.filter((e) => e.name === 'analyst.repair')).toHaveLength(1);
    });

    it('budget runs out mid-turn (3 tool_use, max 2) → BUDGET_EXCEEDED before the 3rd tool runs', async () => {
      const multi: FakeStep = {
        stopReason: 'tool_use',
        content: ['x', 'y', 'z'].map((id) => ({ type: 'tool_use' as const, id, name: 'query_certified_metric', input: {} })),
      };
      const llm = new ScriptedFakeProvider([multi, final(answered)]);
      const tool = new FakeTool(() => ok(result));
      const c = ctx(2);
      const run = await agent(llm, tool).answer('q', c);

      expect(run.ok).toBe(false);
      if (run.ok) return;
      expect(run.error.code).toBe('BUDGET_EXCEEDED');
      expect(tool.inputs).toHaveLength(2);
      expect(llm.requests).toHaveLength(1); // the scripted answer is never requested
      const exceeded = c.tracer.summary().events.find((e) => e.name === 'budget.exceeded');
      expect(exceeded?.data?.reason).toBe('tool calls 3 > 2');
    });

    it('token budget exceeded by an LLM call → BUDGET_EXCEEDED before any tool runs', async () => {
      const llm = new ScriptedFakeProvider([{ ...toolUse('t1'), usage: { inputTokens: 40_001, outputTokens: 10 } }, final(answered)]);
      const tool = new FakeTool(() => ok(result));
      const run = await agent(llm, tool).answer('q', ctx());

      expect(run.ok).toBe(false);
      if (run.ok) return;
      expect(run.error.code).toBe('BUDGET_EXCEEDED');
      expect(tool.inputs).toHaveLength(0);
    });
  });
});
