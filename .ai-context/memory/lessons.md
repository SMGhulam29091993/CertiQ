# lessons.md — a wrong assumption about *approach*
_Includes agent-drift corrections made during sessions, each with the rule/test that now prevents it.
Populate only with real events._

### 2026-11-08 — A one-week, two-dimension breakdown suppresses everything
**What we assumed:** "Tickets by state × category, first week of October" would show a mix of shown and suppressed cells.
**What was actually true:** At this data volume all 17 cells (then all 41 for a full month) were below k=10, so the golden case tested nothing but "everything suppressed".
**Carry forward:** Check a suppression case's ground truth with `pnpm eval:truth` before committing it; the case now uses billing × state over May–Oct (10 rows, 1 suppressed).
