# Plan: Ask console (API + web)
## Derived From
.ai-context/specs/ask-console.spec.md
## Architecture Approach
API: `config.ts` (Zod env, exit on invalid) → `container.ts` (composition root) → `main.ts`
(ping DB, then listen) → modules ask/metrics/health with class controllers, `validate()` middleware,
envelope helpers, helmet/CORS/rate-limit. Web: Next.js App Router, one client component calling the
API, `AnswerCard` + `CatalogPanel`, CSS tokens with dark mode, no UI library.
## Data Model
None.
## Constitution Check
- [x] Envelope + openapi.yaml in same change
- [x] Startup fail-fast
- [x] Web imports types only from contracts
## Explicitly Deferred
- Auth, history, charts.
## Sequencing
1. API skeleton + health/metrics → 2. ask route (501 until orchestrator) → 3. Web console → 4. End-to-end once agents land
