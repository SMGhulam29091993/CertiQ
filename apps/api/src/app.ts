import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Container } from './container';
import { errorHandler } from './http/error-handler';
import { sendFailure } from './http/response';
import { askRoutes } from './modules/ask/ask.routes';
import { healthRoutes } from './modules/health/health.routes';
import { metricsRoutes } from './modules/metrics/metrics.routes';

export function createApp(container: Container, webOrigin: string): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: webOrigin }));
  app.use(express.json({ limit: '16kb' }));

  app.use('/api/v1/health', healthRoutes(container.repository, container.registry));
  app.use('/api/v1/metrics', metricsRoutes(container.registry));
  app.use('/api/v1/ask', askRoutes(container.orchestrator));

  app.use((_req, res) => sendFailure(res, 404, 'Not found'));
  app.use(errorHandler);
  return app;
}
