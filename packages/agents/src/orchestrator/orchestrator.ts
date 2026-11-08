import {
  NotImplementedError,
  type AskResponse,
  type IAnalystAgent,
  type IAuditorAgent,
  type IGuardrailChain,
  type InputGuardrailInput,
  type IOrchestrator,
  type IRunContextFactory,
  type OutputGuardrailInput,
} from '@certiq/contracts';

export interface OrchestratorDeps {
  readonly inputGuardrails: IGuardrailChain<InputGuardrailInput>;
  readonly analyst: IAnalystAgent;
  readonly outputGuardrails: IGuardrailChain<OutputGuardrailInput>;
  readonly auditor: IAuditorAgent;
  readonly contexts: IRunContextFactory;
}

/**
 * LIVE BUILD — analyst-auditor-agents.T04 (spec AC8–AC10).
 *
 * Pipeline (each step traced, budget checked between steps):
 *   input guardrails ─blocked→ status 'blocked'
 *     → analyst.answer ─error→ status 'error' (BUDGET_EXCEEDED surfaces its reason)
 *     → if answer.status !== 'answered' → return refused / needs_clarification (skip audit)
 *     → output guardrails ─blocked→ status 'blocked'
 *     → auditor.audit ─pass=false→ status 'blocked' (blockedBy: 'auditor')
 *     → status 'answered'
 * The orchestrator never edits the answer. It only routes, gates and records.
 */
export class Orchestrator implements IOrchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  async ask(_question: string): Promise<AskResponse> {
    void this.deps;
    throw new NotImplementedError('analyst-auditor-agents.T04');
  }
}
