import type { Request, Response } from 'express';
import type { IOrchestrator } from '@certiq/contracts';
import { sendSuccess } from '../../http/response';
import type { AskBody } from './ask.types';

/** HTTP in/out only. All decisions live in the orchestrator. */
export class AskController {
  constructor(private readonly orchestrator: IOrchestrator) {}

  ask = async (req: Request, res: Response): Promise<void> => {
    const { question } = req.validated as AskBody;
    const result = await this.orchestrator.ask(question);
    sendSuccess(res, result, result.userMessage);
  };
}
