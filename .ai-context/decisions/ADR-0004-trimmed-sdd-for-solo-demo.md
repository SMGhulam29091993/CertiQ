# ADR-0004: Trimmed Hybrid SDD/AIPOS setup for a solo demo

## Context
The full Hybrid SDD/AIPOS system assumes a team: separate reviewers, six tool entry files, per-slug
test-case files. This project has one author and a 2-day window.

## Decision
Keep: all five `.agent/rules/` files, three workflows, BRD → spec → plan → tasks per slug, state/,
memory/, decisions/, ownership index, the tripwire pattern.
Trim:
- Entry files: `CLAUDE.md` and `AGENTS.md` only (byte-identical) — the only tools in use.
- Per-slug `test_cases/` files: the spec's "Unit Test Cases" table is the canonical owner; only
  `test_cases/_integration.md` exists.
- Gate reviewers: the author, declared openly as self-review in `governance.md`.
- `generate-tests.md` workflow omitted.
Add: Claude Code hooks enforce what prose rules can't (golden set protection, typecheck, stop checks).

## Consequences
+ The process is real and exercised, at a size that matches the project.
− No reviewer independence; mitigated partly by the read-only `eval-reviewer` subagent.
