import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { sendFailure } from './response';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validated?: unknown;
    }
  }
}

/** Parses req[source] once; controllers read req.validated, never the raw body. */
export const validate =
  (schema: ZodTypeAny, source: 'body' | 'query' | 'params' = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      sendFailure(res, 400, 'Validation failed', parsed.error.issues);
      return;
    }
    req.validated = parsed.data;
    next();
  };
