import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { IOrchestrator } from '@certiq/contracts';
import { validate } from '../../http/validate';
import { AskController } from './ask.controller';
import { AskBodySchema } from './ask.types';

/** ask-console.API01 — POST /api/v1/ask (documented in apps/api/openapi.yaml). */
export function askRoutes(orchestrator: IOrchestrator): Router {
  const controller = new AskController(orchestrator);
  const router = Router();
  router.post(
    '/',
    rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }),
    validate(AskBodySchema),
    controller.ask,
  );
  return router;
}
