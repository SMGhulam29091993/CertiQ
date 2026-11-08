# Plan: Analyst + auditor agents and orchestrator
## Derived From
.ai-context/specs/analyst-auditor-agents.spec.md
## Architecture Approach
- `AnalystAgent(ILLMProvider, IMetricTool, opts)`: loop ≤ budget; tool errors fed back as `isError`;
  final JSON → `AnalystAnswerSchema`; one repair turn on parse failure.
- `AuditorAgent(ILLMProvider, opts)`: single strong-tier call with question + answer + evidence
  rendered as compact JSON (rows, suppression flags, metric description); verdict normalised so any
  blocker forces `pass=false`.
- `Orchestrator(deps)`: pure routing; per-run `RunContext` from `IRunContextFactory`.
- Runtime (`TokenBudget`, `InMemoryTracer`, `RunContextFactory`) pre-built.
- Prompts in `src/prompts/*.system.md`, loaded by the composition root.
## Data Model
None.
## Constitution Check
- [x] Agents depend on `IMetricTool`, never on registry/compiler/repository
- [x] Auditor separate context; cannot edit (Invariants 2, 3)
- [x] Budget after every call (Invariant 4)
- [x] Unit tests with `ScriptedFakeProvider`, no network
## Explicitly Deferred
- Conversation memory, streaming, parallel tool calls.
## Sequencing
1. Prompts → 2. Analyst loop → 3. Auditor → 4. Orchestrator → 5. Fake-provider unit tests
