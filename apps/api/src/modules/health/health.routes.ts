import { Router } from 'express';
import type { IMetricRegistry, IMetricRepository } from '@certiq/contracts';
import { sendFailure, sendSuccess } from '../../http/response';

/** ask-console.API03 — GET /api/v1/health */
export function healthRoutes(repository: IMetricRepository, registry: IMetricRegistry): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    const db = await repository.ping();
    if (!db.ok) {
      sendFailure(res, 503, 'Database unreachable');
      return;
    }
    sendSuccess(res, { db: 'up', registryVersion: registry.version(), metrics: registry.listMetrics().length });
  });
  return router;
}
