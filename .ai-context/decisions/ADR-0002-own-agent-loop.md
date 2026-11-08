# ADR-0002: Own agent loop on the Messages API, behind ILLMProvider

## Context
Options: an agent framework / SDK loop, or a small hand-written loop over the Messages API.
The value of this project is the harness: where budget is checked, how tool errors are fed back,
how the final answer is validated, how generator and judge are separated.

## Decision
Hand-written loop in `AnalystAgent`, provider-neutral types in `@certiq/contracts/llm.ts`,
Anthropic adapter in `@certiq/llm`. Model per role: `fast` tier for the analyst (many short tool
turns), `strong` tier for the auditor (one careful judgement). Model ids live in config, not code.

## Consequences
+ Every harness decision is visible and testable with `ScriptedFakeProvider`.
+ Swapping vendor or model is a config/adapter change.
− We re-implement retries/streaming conveniences a framework would provide (not needed here).
