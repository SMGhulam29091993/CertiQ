import type { Request, Response } from 'express';
import type { IMetricRegistry } from '@certiq/contracts';
import { sendSuccess } from '../../http/response';

/** Exposes the certified catalog (definitions only, never data) for the UI. */
export class MetricsController {
  constructor(private readonly registry: IMetricRegistry) {}

  list = (_req: Request, res: Response): void => {
    sendSuccess(res, {
      registryVersion: this.registry.version(),
      metrics: this.registry.listMetrics().map(({ id, version, label, description, unit, dimensions, owner, synonyms }) => ({
        id,
        version,
        label,
        description,
        unit,
        dimensions,
        owner,
        synonyms,
      })),
      dimensions: this.registry.listDimensions().map(({ id, label, values }) => ({ id, label, values })),
    });
  };
}
