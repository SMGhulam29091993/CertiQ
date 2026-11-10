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
  type Result,
} from '@certiq/contracts';
import { RunContextFactory } from '../runtime/run-context-factory';
import { Orchestrator, type OrchestratorDeps } from './orchestrator';

const answer: AnalystAnswer = {
  status: 'answered',
  summary: '4,321 orders were completed in October 2026.',
  figures: [{ label: 'Orders', value: 4321, unit: 'count', metricId: 'completed_orders', metricVersion: '1.0.0', period: '2026-10' }],
  suggestedMetrics: [],
};

const allow = <T>(id: string): IGuardrailChain<T> => ({
  run: async (value: T): Promise<ChainOutcome<T>> => ({ blocked: false, value, applied: [id] }),
});
const block = <T>(id: string): IGuardrailChain<T> => ({
  run: async (): Promise<ChainOutcome<T>> => ({ blocked: true, by: id, reason: 'internal', userMessage: 'safe', applied: [id] }),
});

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
  });

  it('AC9 — input block stops before the analyst runs', async () => {
    const an = analyst(ok({ answer, evidence: [], toolCalls: 0 }));
    const res = await new Orchestrator(deps({ inputGuardrails: block('input.phi_request'), analyst: an })).ask('q');
    expect(res.status).toBe('blocked');
    expect(res.blockedBy?.guardrail).toBe('input.phi_request');
    expect(an.calls).toBe(0);
  });

  it('AC9 — audit failure → blocked by auditor', async () => {
    const res = await new Orchestrator(
      deps({ auditor: auditor(ok({ pass: false, issues: [{ severity: 'blocker', message: 'wrong period' }] })) }),
    ).ask('q');
    expect(res.status).toBe('blocked');
    expect(res.blockedBy).toEqual({ guardrail: 'auditor', reason: 'wrong period' });
  });

  it('AC8 — analyst BUDGET_EXCEEDED → error', async () => {
    const res = await new Orchestrator(deps({ analyst: analyst(err('BUDGET_EXCEEDED', 'tool calls 5 > 4')) })).ask('q');
    expect(res.status).toBe('error');
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
  });
});
