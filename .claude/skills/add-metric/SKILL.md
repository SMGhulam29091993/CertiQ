---
name: add-metric
description: Add or change a certified metric in packages/semantic-layer/metrics.yaml with versioning, tests and an ownership entry. Use whenever someone asks to add, rename, redefine or remove a metric.
---

# Add or change a certified metric

A metric is a promise about meaning. Treat every change as a contract change.

## 1. Confirm before writing
Ask the user for: business definition (one sentence a finance person would sign), owner team,
unit, source view, time column, allowed dimensions, and 2–4 synonyms people actually say.
Do not invent a definition. If the source view doesn't expose a needed column, stop — that is a
schema change (ADR required), not a metric change.

## 2. Edit `packages/semantic-layer/metrics.yaml`
- New metric → `version: 1.0.0`, `certified_at: <today>`; bump `registry_version` minor.
- Changed meaning → bump the metric's `version` minor and `registry_version` minor.
- Rename/remove → major bump + ADR in `.ai-context/decisions/`.
- `aggregation` must be a single aggregate expression over the source view. No subqueries, no
  references to base tables.

## 3. Verify
- `pnpm --filter @certiq/semantic-layer test` (registry integrity runs at load).
- Run `pnpm eval:truth` to make sure existing cases still produce rows.
- Ask the user to add a golden case for the new metric (agents cannot write `golden/`), and
  propose its YAML in chat for them to paste.

## 4. Record
- `.ai-context/ownership_index.md` — metric definitions are owned by `metrics.yaml`; add the metric id
  under "Referenced by" only if a spec mentions it.
- `state/prompt_history.md` entry per `state-tracking.md`.
