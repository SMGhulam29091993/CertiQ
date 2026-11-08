# ADR-0005: Just-in-time internal packages in a Turborepo/pnpm monorepo

## Context
Each module is a workspace package so dependency direction is enforced by `package.json`, not by
convention. Building every package to `dist/` adds watch processes and stale-build bugs.

## Decision
Internal packages export TypeScript source (`"exports": { ".": "./src/index.ts" }`). `tsx` runs the
API and scripts; Next transpiles via `transpilePackages`; Turbo orchestrates `typecheck`/`test`
with `dependsOn: ["^typecheck"]` and caches untouched packages.

## Consequences
+ Zero build step for libraries; edits are live everywhere instantly.
+ An undeclared cross-package import fails to resolve — the dependency graph is enforced.
− Packages aren't publishable as-is (not a goal).
