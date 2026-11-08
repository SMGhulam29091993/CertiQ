# next.md
## Queued
- Gate 1 self-review — all six specs — blocked on: none
- analyst-auditor-agents.T01 — prompts — blocked on: Gate 1
- analyst-auditor-agents.T02 — analyst loop — blocked on: T01
- analyst-auditor-agents.T03 — auditor — blocked on: T01
- answer-guardrails.T04 — numeric grounding — blocked on: Gate 1
- analyst-auditor-agents.T04 — orchestrator — blocked on: T02, T03, answer-guardrails.T04
- eval-harness.T02–T05 — runner, graders, report, gate — blocked on: analyst-auditor-agents.T04
- ask-console.T04 — end-to-end browser check — blocked on: analyst-auditor-agents.T04
