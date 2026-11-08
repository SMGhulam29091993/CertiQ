/**
 * Result type used across every layer boundary.
 * Expected failures (uncertified metric, guardrail block, budget exceeded) are
 * values, not exceptions — so callers are forced by the type system to handle them.
 * Exceptions are reserved for genuine bugs.
 */

export type ErrorCode =
  | 'NOT_CERTIFIED'
  | 'INVALID_QUERY'
  | 'GUARDRAIL_BLOCKED'
  | 'BUDGET_EXCEEDED'
  | 'LLM_ERROR'
  | 'DB_ERROR'
  | 'TIMEOUT'
  | 'AUDIT_FAILED'
  | 'NOT_IMPLEMENTED';

export interface AppError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

export type Result<T, E extends AppError = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const err = (code: ErrorCode, message: string, details?: unknown): Result<never> => ({
  ok: false,
  error: { code, message, details },
});

/** Thrown only by stubs that are scheduled for a task — names the task so drift is traceable. */
export class NotImplementedError extends Error {
  constructor(taskId: string) {
    super(`Not implemented yet — see ${taskId} in .ai-context/tasks/`);
    this.name = 'NotImplementedError';
  }
}
