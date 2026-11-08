# CertiQ — Project Context Index

## Summary
CertiQ answers business questions for a telehealth operator (orders, revenue, approvals, support)
using only a governed catalog of certified metrics. The model never sees SQL, never computes a
number, and refuses or asks for clarification instead of guessing. Every answer shows the metric
version, the exact parameterized query and the guardrails it passed. Built as an interview demo
(Nov 2026) on synthetic data; designed so each piece would survive production review.

## Current sprint
Pre-build complete (registry, certified tool, input/tool-result guardrails, API, web console, eval
loader). Live-build remaining: analyst + auditor agents, orchestrator, numeric-grounding guardrail,
eval runner/graders/gate. See `state/current.md` and `state/next.md`; spec-level view in `status.md`.
Known deviation: pre-built tasks were implemented before any Gate 1 ran — recorded in `state/completed.md`.

## Architecture, in one paragraph
Interfaces live in `@certiq/contracts`; every other package depends on them, never on each other's
classes. `apps/api/src/container.ts` is the single composition root. A question flows: input
guardrails → Analyst (fast model, one typed tool) → `CertifiedMetricTool` (Zod → registry-checked
compiler → read-only Postgres → small-group suppression) → output guardrails (citation, numeric
grounding) → Auditor (strong model, separate context, pass/fail only) → response with trace. Full
detail: `architecture.md`.

## Critical, non-negotiable rules
- The model never writes SQL and never produces a number the tool didn't return — `constitution.md › Security Posture`.
- Only interfaces cross package boundaries; `new` only in the composition root — `constitution.md › Architectural Constraints`.
- Agents never edit `packages/evals/golden/**` or `baseline.json` — hook-enforced, `constitution.md › Testing Discipline`.
- Metrics change only via `metrics.yaml` + the `add-metric` skill — `constitution.md › Versioning Rules`.
- Routes and `openapi.yaml` change together — `int-standards.ts.md`.
- State files never go stale — `state-tracking.md`.

Full rule text: `.agent/rules/agent-role.md`, `int-standards.ts.md`, `constitution.md`, `governance.md`.

## Index
### Rules (`.agent/rules/`)
- `agent-role.md` · `constitution.md` · `int-standards.ts.md` · `state-tracking.md` · `governance.md`
### Workflows (`.agent/workflows/`)
- `generate-plan.md` · `code-review.md` · `gate-review-dashboard.md`
### Requirements & delivery
- `BRD.md` → `specs/` → `plans/` → `tasks/`; `test_cases/_integration.md`; board in `status.md`
### State (`state/`)
- `current.md` · `completed.md` · `next.md` · `blockers.md` · `prompt_history.md`
### Decisions (`decisions/`)
- ADR-0001 no RAG over data · ADR-0002 own agent loop · ADR-0003 hand-built SQL compiler
- ADR-0004 trimmed SDD for a solo demo · ADR-0005 just-in-time internal packages
### Memory (`memory/`)
- `lessons.md` · `pitfalls.md` · `patterns.md` · `review-findings.md`
### Ownership Index
- `ownership_index.md`
### Claude Code setup
- `CLAUDE.md` / `AGENTS.md` (byte-identical tripwire) · `.claude/settings.json` (hooks, deny rules)
- `.claude/agents/eval-reviewer.md` · `.claude/skills/add-metric/SKILL.md`
