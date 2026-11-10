# prompt_history.md
_Append-only. One entry per completed task. No secrets, no data rows._

### [2026-11-08] — pre-build (multiple slugs)
**User Request:** Scaffold the certified-metrics analyst demo as a Turborepo monorepo following the Hybrid SDD/AIPOS guide, with a Next.js frontend.
**Agent Action:** Created contracts, database, semantic-layer, guardrails, llm, agents (runtime + stubs), evals (loader + 11 golden cases + ground-truth CLI), api, web; `.agent/` rules and workflows; `.ai-context/` BRD, 6 specs/plans/tasks, ADR-0001…0005; Claude Code hooks, `eval-reviewer` subagent, `add-metric` skill. Verified typecheck, unit tests, golden validation, seeded-DB ground truth, read-only role, API boot, Next build.

### [2026-11-08] — certified-metric-tool.T06
**User Request:** Use Prisma for the data layer.
**Agent Action:** Added `schema.prisma`, `prisma.config.ts` (loads root .env), migrations `init` + `certified_views_and_reader_role`, `createPrismaClient`, pure `generateDataset` + Prisma seed, `PrismaMetricRepository`; removed raw-SQL schema, `migrate.ts`, `PgMetricRepository`, `pg` deps. ADR-0006 supersedes ADR-0003. New tests UT07–UT09, IT01–IT04. Verified on a fresh Postgres: migrations apply, seed counts unchanged, ground truth identical to the pre-Prisma run, all 24 tests green, API boots. Not verifiable in the sandbox: `prisma migrate deploy` / `db:drift` (schema-engine download blocked) — queued in next.md.

### [2026-11-10] — analyst-auditor-agents.T01–T04, answer-guardrails.T04, eval-harness.T03
**User Request:** Implement the live-build tasks with two subagents (A: numeric grounding, B: graders) on disjoint files.
**Agent Action:** T01 finalised `analyst.system.md` / `auditor.system.md` (output schema, answered + refused examples, two auditor calibration examples; dropped the unused `{{registry_version}}` placeholder). T02 `AnalystAgent` loop with one repair turn, budget check after every LLM/tool call, SQL hidden from the model; T03 `AuditorAgent` (fresh context, blocker ⇒ pass=false, fail closed with AUDIT_FAILED); T04 `Orchestrator` routing + UT06. Subagent A: `numeric-grounding.guardrail.ts` + spec (12 tests). Subagent B: `packages/evals/src/graders.ts` + spec (16 tests). Ownership held: no file touched by two agents. Typecheck (uncached) and 70 unit tests green; no live-LLM run.

### [2026-11-10] — eval-harness.T02, T04, T05
**User Request:** The eval harness was meant to be built by subagent B.
**Agent Action:** Main agent added `buildContainer(config, { today })` and `@certiq/api` exports (`./container`, `./config`). Subagent B built `runner.ts`, `report.ts`, `gate.ts` (+ specs, 31 evals tests), rewrote `cli.ts` (exit 0/1/2/3), added `@certiq/api` to evals deps, added `eval:fast` to the Stop hook. Main agent made that hook step opt-in (`CERTIQ_EVAL_ON_STOP=1`) because a present `.env` would trigger a paid live run on every stop. Verified: uncached typecheck, 85 unit tests, `eval:validate`, `--fast` without env exits 2. No live eval run.

### [2026-11-10 21:44] — analyst-auditor-agents.T01 (revision)
**User Request:** Finish both prompts (AnalystAnswer field list, examples, auditor calibration), add a "figure or summary number differs from the evidence" auditor blocker, and map each analyst hard rule to its golden case.
**Agent Action:** `analyst.system.md`: field list now marks required/optional fields, states that extra keys are rejected (schema is `.strict()`), and that suppressed rows never become figures. The existing answered + refused examples were kept. `auditor.system.md`: added the new blocker (wrong row/period/metric attribution, wrong unit; display rounding allowed), and replaced the "numeric matching is NOT its job" note with the reason the blocker exists: numeric_grounding matches by value against any row. The existing two calibration examples were kept (#1 is the looks-fine-must-fail case). Rule→golden map produced; untested rules queued in next.md. Agents tests green (18); no live-LLM run.
