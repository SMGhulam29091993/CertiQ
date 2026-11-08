import { Router } from 'express';
import type { IMetricRegistry } from '@certiq/contracts';
import { MetricsController } from './metrics.controller';

/** ask-console.API02 — GET /api/v1/metrics */
export function metricsRoutes(registry: IMetricRegistry): Router {
  const controller = new MetricsController(registry);
  const router = Router();
  router.get('/', controller.list);
  return router;
}
