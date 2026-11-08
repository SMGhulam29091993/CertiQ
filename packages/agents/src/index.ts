export { TokenBudget, type PriceTable } from './runtime/token-budget';
export { InMemoryTracer } from './runtime/in-memory-tracer';
export { RunContextFactory } from './runtime/run-context-factory';
export { AnalystAgent, type AnalystAgentOptions } from './analyst/analyst.agent';
export { AuditorAgent, type AuditorAgentOptions } from './auditor/auditor.agent';
export { Orchestrator, type OrchestratorDeps } from './orchestrator/orchestrator';

import { fileURLToPath } from 'node:url';
export const PROMPT_PATHS = {
  analyst: fileURLToPath(new URL('./prompts/analyst.system.md', import.meta.url)),
  auditor: fileURLToPath(new URL('./prompts/auditor.system.md', import.meta.url)),
} as const;
