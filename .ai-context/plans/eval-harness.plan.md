# Plan: Eval harness
## Derived From
.ai-context/specs/eval-harness.spec.md
## Architecture Approach
- `golden-case.ts` (pre-built): schema + loader.
- Runner: build the same container as the API (import a shared builder or reuse `buildContainer`),
  run each case `trials` times with injected `today`; collect AskResponse + trace.
- Graders: one pure function per concern (status, numeric, suppression) → `{pass, reason}`.
- Report: table to stdout + JSON to `packages/evals/reports/<timestamp>.json`.
- Gate: compare regression cases' pass^k to `baseline.json`; exit 1 on drop.
## Data Model
`baseline.json`: `{ recordedAt, registryVersion, cases: { [id]: { passK: number, trials: number } } }`
## Constitution Check
- [x] Ground truth from the certified tool, not literals
- [x] Golden/baseline write-protected by hooks
## Explicitly Deferred
- LLM-graded summary quality; CI workflow file.
## Sequencing
1. Loader (done) → 2. Runner → 3. Graders → 4. Report → 5. Baseline gate
