import type { Response } from 'express';

/** The one response shape every endpoint returns (int-standards.ts.md). */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export const sendSuccess = <T>(res: Response, data: T, message = 'OK', status = 200): void => {
  res.status(status).json({ success: true, message, data } satisfies ApiResponse<T>);
};

export const sendFailure = (res: Response, status: number, message: string, data?: unknown): void => {
  res.status(status).json({ success: false, message, ...(data !== undefined ? { data } : {}) } satisfies ApiResponse);
};
