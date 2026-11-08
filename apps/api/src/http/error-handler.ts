import type { NextFunction, Request, Response } from 'express';
import { NotImplementedError } from '@certiq/contracts';
import { sendFailure } from './response';

/** Last-resort handler. Never leaks stack traces or internal messages to clients. */
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof NotImplementedError) {
    sendFailure(res, 501, error.message);
    return;
  }
  console.error('[unhandled]', error);
  sendFailure(res, 500, 'Internal error');
}
