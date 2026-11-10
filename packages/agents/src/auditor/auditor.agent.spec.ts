import { describe, expect, it } from 'vitest';
import type { AnalystAnswer, MetricResult } from '@certiq/contracts';
import { ScriptedFakeProvider, type FakeStep } from '@certiq/llm';
import { RunContextFactory } from '../runtime/run-context-factory';
import { AuditorAgent } from './auditor.agent';

const evidence: MetricResult[] = [
  {
    metricId: 'completed_orders',
    metricVersion: '1.0.0',
    registryVersion: '1.0.0',
    unit: 'count',
    query: { metric: 'completed_orders', dimensions: [], filters: {}, time_range: { start: '2026-10-01', end: '2026-11-01' }, limit: 100 },
    rows: [{ period: null, dimensions: {}, value: 4321, patientCount: 900, suppressed: false }],
    suppressedRows: 0,
    sql: 'SELECT secret_sql_marker',
    params: [],
    executedAt: '2026-11-08T00:00:00Z',
    durationMs: 2,
  },
];
const answer: AnalystAnswer = {
  status: 'answered',
  summary: '4,321 orders were completed in October 2026.',
  figures: [{ label: 'Orders', value: 4321, unit: 'count', metricId: 'completed_orders', metricVersion: '1.0.0', period: '2026-10' }],
  suggestedMetrics: [],
};
const input = { question: 'Completed orders last month?', answer, evidence };
const ctx = () =>
  new RunContextFactory({ maxToolCalls: 4, maxInputTokens: 40_000, maxOutputTokens: 4_000, maxUsd: null }, { fast: null, strong: null }).create();
const say = (text: string): FakeStep => ({ stopReason: 'end_turn', content: [{ type: 'text', text }] });
const auditor = (llm: ScriptedFakeProvider) => new AuditorAgent(llm, { systemPrompt: 'audit', maxTokens: 800 });

describe('AuditorAgent', () => {
  it('analyst-auditor-agents.UT04 — request carries only question, answer and evidence; no tool blocks', async () => {
    const llm = new ScriptedFakeProvider([say('{"pass":true,"issues":[]}')]);
    await auditor(llm).audit(input, ctx());

    const req = llm.requests[0]!;
    expect(req.tier).toBe('strong');
    expect(req.tools).toBeUndefined();
    expect(req.messages).toHaveLength(1);
    const blocks = req.messages.flatMap((m) => m.content);
    expect(blocks.every((b) => b.type === 'text')).toBe(true);
    const sent = JSON.parse((blocks[0] as { text: string }).text);
    expect(Object.keys(sent).sort()).toEqual(['answer', 'evidence', 'question']);
    expect(JSON.stringify(sent)).not.toContain('secret_sql_marker');
  });

  it('analyst-auditor-agents.UT04 — repair turn adds no tool blocks and no analyst reasoning, even if the model emits tool_use', async () => {
    const llm = new ScriptedFakeProvider([
      { stopReason: 'tool_use', content: [{ type: 'text', text: 'checking' }, { type: 'tool_use', id: 't1', name: 'query_certified_metric', input: {} }] },
      say('{"pass":true,"issues":[]}'),
    ]);
    // Extra runtime fields must not ride along on the answer.
    const leaky = { ...answer, reasoning: 'ANALYST_REASONING_MARKER' } as AnalystAnswer;
    const v = await auditor(llm).audit({ ...input, answer: leaky }, ctx());
    expect(v.ok).toBe(true);

    expect(llm.requests).toHaveLength(2);
    for (const req of llm.requests) {
      expect(req.tools).toBeUndefined();
      const blocks = req.messages.flatMap((m) => m.content);
      expect(blocks.map((b) => b.type)).not.toContain('tool_use');
      expect(blocks.map((b) => b.type)).not.toContain('tool_result');
      const text = JSON.stringify(req.messages);
      expect(text).not.toContain('ANALYST_REASONING_MARKER');
      expect(text).not.toContain('secret_sql_marker');
    }
  });

  it('analyst-auditor-agents.UT05 — pass:true with a blocker is forced to pass=false', async () => {
    const llm = new ScriptedFakeProvider([say('{"pass":true,"issues":[{"severity":"blocker","message":"wrong period"}]}')]);
    const v = await auditor(llm).audit(input, ctx());
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.pass).toBe(false);
    expect(v.value.issues).toHaveLength(1);
  });

  it('AC6 — auditor rejects an answer: pass=false, blocker issues returned unchanged', async () => {
    const llm = new ScriptedFakeProvider([
      say('{"pass":false,"issues":[{"severity":"blocker","message":"answer covers September, question asked October"},{"severity":"warning","message":"vague label"}]}'),
    ]);
    const v = await auditor(llm).audit(input, ctx());
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value).toEqual({
      pass: false,
      issues: [
        { severity: 'blocker', message: 'answer covers September, question asked October' },
        { severity: 'warning', message: 'vague label' },
      ],
    });
    expect(llm.requests).toHaveLength(1);
  });

  it('AC6 — pass:false with no issues stays false', async () => {
    const v = await auditor(new ScriptedFakeProvider([say('{"pass":false,"issues":[]}')])).audit(input, ctx());
    expect(v.ok && v.value.pass).toBe(false);
  });

  it('warnings alone keep pass=true', async () => {
    const v = await auditor(new ScriptedFakeProvider([say('{"pass":true,"issues":[{"severity":"warning","message":"partial month"}]}')])).audit(input, ctx());
    expect(v.ok && v.value.pass).toBe(true);
  });

  it('AC7 — repairs once, then fails closed', async () => {
    const repaired = await auditor(new ScriptedFakeProvider([say('looks good'), say('{"pass":true,"issues":[]}')])).audit(input, ctx());
    expect(repaired.ok).toBe(true);

    const llm = new ScriptedFakeProvider([say('looks good'), say('still prose'), say('{"pass":true,"issues":[]}')]);
    const failed = await auditor(llm).audit(input, ctx());
    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.error.code).toBe('AUDIT_FAILED');
    // Exactly one repair: the third (valid) scripted reply is never requested.
    expect(llm.requests).toHaveLength(2);
  });

  it('AC7 — max_tokens mid-JSON counts as unparseable and is repaired', async () => {
    const llm = new ScriptedFakeProvider([
      { stopReason: 'max_tokens', content: [{ type: 'text', text: '{"pass":true,"iss' }] },
      say('{"pass":true,"issues":[]}'),
    ]);
    const v = await auditor(llm).audit(input, ctx());
    expect(v.ok && v.value.pass).toBe(true);
    expect(llm.requests).toHaveLength(2);
  });

  it('AC7 — malformed issue (unknown severity) is unparseable, not silently passed', async () => {
    const llm = new ScriptedFakeProvider([
      say('{"pass":true,"issues":[{"severity":"critical","message":"x"}]}'),
      say('{"pass":true,"issues":[{"severity":"critical","message":"x"}]}'),
    ]);
    const v = await auditor(llm).audit(input, ctx());
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.error.code).toBe('AUDIT_FAILED');
  });
});
