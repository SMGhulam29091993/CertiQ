import type { GuardrailVerdict, IOutputGuardrail, OutputGuardrailInput } from '@certiq/contracts';

/**
 * Every figure in an answer must cite a metric id + version that was actually
 * returned by the certified tool during this run.
 */
export class CitationGuardrail implements IOutputGuardrail {
  readonly id = 'output.citation';
  readonly stage = 'output' as const;

  async check(input: OutputGuardrailInput): Promise<GuardrailVerdict<OutputGuardrailInput>> {
    const { answer, evidence } = input;
    if (answer.status !== 'answered') return { action: 'allow' };
    if (answer.figures.length === 0) {
      return {
        action: 'block',
        reason: 'answered with no figures',
        userMessage: 'I couldn’t produce a certified answer for that question.',
      };
    }
    const cited = new Set(evidence.map((e) => `${e.metricId}@${e.metricVersion}`));
    const uncited = answer.figures.filter((f) => !cited.has(`${f.metricId}@${f.metricVersion}`));
    if (uncited.length === 0) return { action: 'allow' };
    return {
      action: 'block',
      reason: `figures cite metrics not in evidence: ${uncited.map((f) => `${f.metricId}@${f.metricVersion}`).join(', ')}`,
      userMessage: 'I couldn’t verify every number against a certified metric, so I’m not showing an answer.',
    };
  }
}
