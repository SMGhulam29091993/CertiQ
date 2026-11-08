# Generate a plan from an approved spec

Precondition: the spec's `Status` has a Gate 1 `Reviewed by: …, Approved` line.

1. Read the spec, `constitution.md`, `architecture.md`, and `ownership_index.md` entries it references.
2. Write `.ai-context/plans/<slug>.plan.md` from the template: Architecture Approach (interfaces first),
   Data Model, Constitution Check (tick each with a one-line justification), Explicitly Deferred, Sequencing.
3. Write `.ai-context/tasks/<slug>.tasks.md`: each task independently verifiable, maps to ≥1 AC,
   small enough to review in one sitting.
4. Add the first task to `state/next.md`. Do not start coding until the user says go.
