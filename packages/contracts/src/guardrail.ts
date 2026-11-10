import type { MetricResult } from './query';
import type { AnalystAnswer } from './agent';

/**
 * Guardrails are small, single-purpose classes composed into a chain (Open/Closed:
 * add a guardrail by adding a class, never by editing the chain or the agent).
 */

export type GuardrailStage = 'input' | 'tool_result' | 'output';

export type GuardrailVerdict<T> =
  | { readonly action: 'allow' }
  | { readonly action: 'transform'; readonly value: T; readonly reason: string }
  | { readonly action: 'block'; readonly reason: string; readonly userMessage: string };

export interface IGuardrail<T> {
  readonly id: string;
  readonly stage: GuardrailStage;
  check(input: T): Promise<GuardrailVerdict<T>>;
}

/** Per-guardrail timing, so the run trace can show each guardrail as its own step. */
export interface GuardrailStepRecord {
  readonly id: string;
  readonly action: GuardrailVerdict<unknown>['action'];
  readonly durationMs: number;
  /** Block reason; absent for allow, the transform reason for transform. */
  readonly reason?: string;
}

export type ChainOutcome<T> =
  | {
      readonly blocked: false;
      readonly value: T;
      readonly applied: readonly string[];
      /** Every guardrail that ran, in order. */
      readonly steps: readonly GuardrailStepRecord[];
    }
  | {
      readonly blocked: true;
      readonly by: string;
      readonly reason: string;
      readonly userMessage: string;
      readonly applied: readonly string[];
      /** Every guardrail that ran, in order; the last one is the block. */
      readonly steps: readonly GuardrailStepRecord[];
    };

export interface IGuardrailChain<T> {
  run(input: T): Promise<ChainOutcome<T>>;
}

/** Stage-specific inputs. */
export interface InputGuardrailInput {
  readonly question: string;
}

export type ToolResultGuardrailInput = MetricResult;

export interface OutputGuardrailInput {
  readonly question: string;
  readonly answer: AnalystAnswer;
  readonly evidence: readonly MetricResult[];
}

export type IInputGuardrail = IGuardrail<InputGuardrailInput>;
export type IToolResultGuardrail = IGuardrail<ToolResultGuardrailInput>;
export type IOutputGuardrail = IGuardrail<OutputGuardrailInput>;
