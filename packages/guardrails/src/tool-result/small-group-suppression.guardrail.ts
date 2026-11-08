import type { GuardrailVerdict, IToolResultGuardrail, MetricResult } from '@certiq/contracts';

/**
 * Privacy guardrail: any result row backed by fewer than `minGroupSize` distinct
 * patients has its value replaced with null and is flagged suppressed. Applied to
 * tool output BEFORE the model sees it, so a small-cohort number can never be
 * repeated in an answer.
 */
export class SmallGroupSuppressionGuardrail implements IToolResultGuardrail {
  readonly id = 'tool_result.small_group_suppression';
  readonly stage = 'tool_result' as const;

  constructor(private readonly minGroupSize = 10) {}

  async check(result: MetricResult): Promise<GuardrailVerdict<MetricResult>> {
    let suppressed = 0;
    const rows = result.rows.map((row) => {
      if (row.patientCount >= this.minGroupSize) return row;
      suppressed++;
      return { ...row, value: null, suppressed: true };
    });
    if (suppressed === 0) return { action: 'allow' };
    return {
      action: 'transform',
      value: { ...result, rows, suppressedRows: result.suppressedRows + suppressed },
      reason: `${suppressed} row(s) below k=${this.minGroupSize} suppressed`,
    };
  }
}
