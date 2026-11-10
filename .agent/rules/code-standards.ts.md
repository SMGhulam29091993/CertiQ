# TypeScript Coding Standards

## Adding a capability (in this order)
1. Interface in `packages/contracts/src/*` (and Zod schema if it crosses a boundary as data).
2. Implementation class in the owning package (`semantic-layer`, `guardrails`, `agents`, `llm`).
3. Colocated `*.spec.ts`.
4. Wire it in `apps/api/src/container.ts` — the only place it is instantiated.
5. If it touches HTTP: route + controller in `apps/api/src/modules/<name>/` and update `apps/api/openapi.yaml` (same change, mandatory).
6. If it changes agent behaviour: add or update a golden case **via the user** (agents can't write `golden/`).

## Package rules
- Internal packages are "just-in-time": `exports` points at `src/index.ts`; no build step.
- A package may import `@certiq/contracts` freely; importing another implementation package is
  allowed only in `apps/*` and `packages/evals`.
- `apps/web` imports **types only** from `@certiq/contracts` (`import type`), and talks to the API over HTTP.

## Per-module pattern (apps/api)
```
modules/<name>/
├── <name>.types.ts       # Zod schemas + inferred types
├── <name>.controller.ts  # class; HTTP in/out only
└── <name>.routes.ts      # wiring, middleware, task-id comment
```

## Per-guardrail pattern (packages/guardrails)
One class per file: `<stage>/<name>.guardrail.ts`, `readonly id = '<stage>.<name>'`, implements
`IGuardrail<T>`, returns `allow | transform | block` — never throws for expected cases.

## Data access (Prisma)
- Get a client only via `createPrismaClient(url)` from `@certiq/database`; never `new PrismaClient()` elsewhere.
- Libraries receive the client (or a repository interface) by constructor — never import a module-level singleton.
- Prefer Prisma models (`createMany`, `findMany`) for owned tables; tagged `$queryRaw\`…\`` when SQL is needed.
- `$queryRawUnsafe`/`$executeRawUnsafe` only in the two allow-listed files (UT09).
- The generated client (`src/generated/prisma`) is git-ignored; `turbo` runs `generate` before typecheck/test/dev.
- Interactive transactions for multi-statement work; always pass `{ timeout, maxWait }`.

## Errors
- Expected failures are `Result` values (`ok`/`err` from contracts). Exceptions are for bugs.
- Stubs throw `NotImplementedError('<slug>.T<NN>')` so a 501 names the task.

## Standardised response shape
`{ success: boolean, message: string, data?: unknown }` via `sendSuccess` / `sendFailure`.
A guardrail block or refusal is `success: true` with `data.status` — it is the system working.

## Input validation
`validate(schema, source)` middleware → `req.validated`. Controllers never parse raw bodies.

## TypeScript
`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (use `import type`). No `any`;
`unknown` + Zod at boundaries.
