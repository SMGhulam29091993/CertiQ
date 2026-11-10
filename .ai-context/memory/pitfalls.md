# pitfalls.md — symptom → root cause → fix

### 2026-11-08 — `tsx`/`vitest` fail on a fresh install
**Root cause:** pnpm 10 blocks dependency build scripts by default, so esbuild's binary isn't installed.
**Fix:** root `package.json` → `"pnpm": { "onlyBuiltDependencies": [...] }` (esbuild, prisma, @prisma/engines, @prisma/client), then `pnpm install`.

### 2026-11-08 — Prisma CLI ignores `.env`
**Root cause:** Prisma 7 no longer auto-loads `.env`; the datasource URL comes from `prisma.config.ts`.
**Fix:** `prisma.config.ts` calls `dotenv.config({ path: '../../.env' })` before `defineConfig`.

### 2026-11-08 — `npx prisma …` installs an 8.0 release candidate
**Root cause:** on 2026-11-08 the `prisma` package's `latest` dist-tag pointed at `8.0.0-rc.33`, while `@prisma/client` latest was 7.10.1.
**Fix:** all three Prisma packages pinned to exactly `7.10.1`; always run the CLI through the workspace (`pnpm db:*`), never a bare `npx prisma@latest`.

### 2026-11-08 — `prisma generate` fails with 403 on `binaries.prisma.sh`
**Root cause:** the CLI downloads its schema-engine binary at startup, even for `generate`; locked-down networks block that host.
**Fix:** allow the host (normal machines need nothing). For `generate` only, `PRISMA_SCHEMA_ENGINE_BINARY` can point at any existing file because generation doesn't execute the engine. Migrate/diff genuinely need the real engine.

### 2026-11-10 — analyst repair turn after a tool call would always fail live
**Symptom:** none in unit tests (ScriptedFakeProvider accepts anything); live, any repair after a tool call returns LLM_ERROR.
**Root cause:** the repair request dropped `tools` (to stop further tool calls) while the history still held tool_use/tool_result blocks, and the Anthropic API rejects such a request.
**Fix:** keep `tools` on the repair turn and treat a tool_use there as a failure (analyst-auditor-agents.T02 revision). The fake provider doesn't model this constraint, so a test asserts tools are present instead.

## Repair turns that replay the model's reply verbatim (2026-11-10, analyst-auditor-agents.T03)
- Symptom: none visible yet. The auditor's repair request would carry a `tool_use` block if the model emitted one, even though the auditor has no tools.
- Root cause: `messages.push({ role: 'assistant', content: res.value.content })` copies every block. That breaks AC5 (no tool blocks in the auditor context), and the Anthropic API rejects tool_use history when no tools are defined.
- Fix: in a tool-less agent, echo only the text of the failed reply. UT04 now checks every request, not just the first. (The analyst has the opposite rule: it keeps `tools` on its repair turn, see T02.)
