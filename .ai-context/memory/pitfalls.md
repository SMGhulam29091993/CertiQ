# pitfalls.md — symptom → root cause → fix

### 2026-11-08 — `tsx`/`vitest` fail on a fresh install
**Root cause:** pnpm 10 blocks dependency build scripts by default, so esbuild's binary isn't installed.
**Fix:** root `package.json` → `"pnpm": { "onlyBuiltDependencies": ["esbuild", "sharp"] }`, then `pnpm install`.
