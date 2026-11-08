# Plan: Answer guardrails
## Derived From
.ai-context/specs/answer-guardrails.spec.md
## Architecture Approach
`IGuardrail<T>` per stage; `GuardrailChain<T>` (transform passes forward, first block wins).
Input: MaxLength, PhiRequest, PromptInjection (regex). Tool-result: SmallGroupSuppression.
Output: Citation, NumericGrounding. Chains assembled in the composition root.
NumericGrounding: build a set of grounded values from non-suppressed evidence rows (+ per-result
totals), compare each figure with relative tolerance; extract numbers from summary prose with a
unit-aware regex, ignoring 4-digit years and date-like tokens; ratios compared as both 0.x and x%.
## Data Model
None.
## Constitution Check
- [x] Deterministic (Guardrail Invariant 1)
- [x] Test-first for every guardrail
## Explicitly Deferred
- LLM topic classifier; per-metric k.
## Sequencing
1. Chain → 2. Input guardrails → 3. Suppression → 4. Citation → 5. Numeric grounding (live)
