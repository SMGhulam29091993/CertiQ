import type {
  AppError,
  AskResponse,
  IAnalystAgent,
  IAuditorAgent,
  IGuardrailChain,
  InputGuardrailInput,
  IOrchestrator,
  IRunContextFactory,
  MetricResult,
  OutputGuardrailInput,
  RunContext,
} from '@certiq/contracts';

export interface OrchestratorDeps {
  readonly inputGuardrails: IGuardrailChain<InputGuardrailInput>;
  readonly analyst: IAnalystAgent;
  readonly outputGuardrails: IGuardrailChain<OutputGuardrailInput>;
  readonly auditor: IAuditorAgent;
  readonly contexts: IRunContextFactory;
}

/** Id recorded in guardrailsApplied / blockedBy when the auditor gates an answer. */
export const AUDITOR_GATE_ID = 'auditor';

const MESSAGES = {
  unavailable: 'The analyst is unavailable — try again.',
  budget: 'That question needed more work than one answer is allowed. Try narrowing it.',
  audit: 'I couldn’t verify this answer well enough to show it.',
  internal: 'Something went wrong while answering. Try again.',
} as const;

/**
 * analyst-auditor-agents.T04 (spec AC8–AC10).
 *
 *   input guardrails ─blocked→ 'blocked'
 *     → analyst ─error→ 'error' (BUDGET_EXCEEDED reason is already in the trace)
 *     → not answered → 'refused' / 'needs_clarification' (no audit: nothing to verify)
 *     → output guardrails ─blocked→ 'blocked'
 *     → auditor ─error→ 'error' (fail closed) ─pass=false→ 'blocked' by 'auditor'
 *     → 'answered'
 * The orchestrator never edits the answer. It only routes, gates and records.
 */
export class Orchestrator implements IOrchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  async ask(question: string): Promise<AskResponse> {
    const ctx = this.deps.contexts.create();
    const applied: string[] = [];
    let evidence: readonly MetricResult[] = [];
    const respond = (r: Omit<AskResponse, 'guardrailsApplied' | 'trace' | 'evidence'>): AskResponse => {
      ctx.tracer.event('run.done', { status: r.status });
      return { ...r, evidence, guardrailsApplied: [...applied], trace: ctx.tracer.summary() };
    };

    try {
      const input = await ctx.tracer.span('guardrails.input', () => this.deps.inputGuardrails.run({ question }));
      applied.push(...input.applied);
      if (input.blocked) {
        ctx.tracer.event('guardrail.blocked', { by: input.by, stage: 'input' });
        return respond({
          status: 'blocked',
          blockedBy: { guardrail: input.by, reason: input.reason },
          userMessage: input.userMessage,
        });
      }

      const run = await ctx.tracer.span('analyst', () => this.deps.analyst.answer(input.value.question, ctx));
      if (!run.ok) return respond(errorResponse(run.error));
      evidence = run.value.evidence;
      const { answer } = run.value;

      if (answer.status !== 'answered') {
        return respond({
          status: answer.status,
          answer,
          userMessage: answer.status === 'needs_clarification' ? (answer.clarifyingQuestion ?? answer.summary) : answer.summary,
        });
      }

      const output = await ctx.tracer.span('guardrails.output', () =>
        this.deps.outputGuardrails.run({ question, answer, evidence }),
      );
      applied.push(...output.applied);
      if (output.blocked) {
        ctx.tracer.event('guardrail.blocked', { by: output.by, stage: 'output' });
        return respond({
          status: 'blocked',
          blockedBy: { guardrail: output.by, reason: output.reason },
          userMessage: output.userMessage,
        });
      }

      const over = ctx.budget.exceeded();
      if (over) return respond(budgetError(ctx, over));

      const audit = await ctx.tracer.span('auditor', () =>
        this.deps.auditor.audit({ question, answer: output.value.answer, evidence }, ctx),
      );
      if (!audit.ok) return respond(errorResponse(audit.error));
      applied.push(AUDITOR_GATE_ID);
      if (!audit.value.pass) {
        const blockers = audit.value.issues.filter((i) => i.severity === 'blocker').map((i) => i.message);
        return respond({
          status: 'blocked',
          answer: output.value.answer,
          audit: audit.value,
          blockedBy: { guardrail: AUDITOR_GATE_ID, reason: blockers.join('; ') || 'auditor failed the answer' },
          userMessage: MESSAGES.audit,
        });
      }

      return respond({
        status: 'answered',
        answer: output.value.answer,
        audit: audit.value,
        userMessage: output.value.answer.summary,
      });
    } catch (e) {
      // Expected failures are Result values; a throw is a bug. Fail closed rather than leak a partial answer.
      ctx.tracer.event('run.exception', { message: e instanceof Error ? e.message : String(e) });
      return respond({ status: 'error', userMessage: MESSAGES.internal });
    }
  }
}

function budgetError(ctx: RunContext, reason: string) {
  ctx.tracer.event('budget.exceeded', { reason });
  return { status: 'error' as const, userMessage: MESSAGES.budget };
}

function errorResponse(e: AppError) {
  switch (e.code) {
    case 'BUDGET_EXCEEDED':
      return { status: 'error' as const, userMessage: MESSAGES.budget };
    case 'AUDIT_FAILED':
      return { status: 'error' as const, userMessage: MESSAGES.audit };
    default:
      return { status: 'error' as const, userMessage: MESSAGES.unavailable };
  }
}
