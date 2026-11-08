# ADR-0001: No RAG over data; retrieval only over metric definitions, and only at scale

## Context
CertiQ must answer "how many / how much" questions correctly and auditably. A common pattern is RAG:
embed documents or rows, retrieve top-k chunks, let the model read and answer. For numeric business
questions that pattern fails structurally:
- **Aggregation needs all rows.** A total over 17,518 orders can't be computed from k retrieved
  chunks; the model silently answers from a sample.
- **Similarity ≠ correctness.** "Revenue Oct 2025" and "revenue Oct 2026" embed almost identically;
  embeddings blur exactly the tokens (dates, ids, numbers) that decide correctness.
- **The model does the arithmetic.** LLM arithmetic over retrieved numbers is unreliable and leaves no
  reproducible query to audit.
- **Staleness.** An index is a snapshot that drifts from the source of truth until re-indexed.
- **Definition drift.** Two chunks defining "revenue" differently get blended into one answer.
- **Privacy.** Row-level chunks can carry individual patient records into the context; suppression and
  row-level security are far harder to enforce in a vector store than on SQL aggregates.
- **Evals.** Exact-number evals become nondeterministic when retrieval varies.

## Decision
Numbers come only from deterministic SQL over certified views, chosen via a typed tool whose inputs
are ids from `metrics.yaml`. No vector store. The whole catalog (9 metrics) goes in the tool
description. `IMetricRegistry.suggest()` uses keyword overlap for "did you mean".

Retrieval becomes appropriate when the *catalog* outgrows the prompt (≈100+ metrics, or many
dimension values), and then only to choose **which certified query to run**:
1. **Metric selection** — hybrid (keyword + embedding) search over metric id/label/description/synonyms
   returns top-k candidates; the tool enum still validates against the full registry.
2. **Entity resolution** — map "Texas", "the spring promo", a SKU nickname to valid dimension values.
3. **Verified query examples** — retrieve past question → validated `MetricQuery` pairs as few-shot.
4. **Glossary/caveats** — retrieve certified definitions and known data-quality notes to cite.
Rule: retrieval may narrow the *choice*; it may never supply the *answer*.

## Consequences
+ Every number is reproducible from a logged query; evals compare exact values.
+ No embedding infrastructure, re-indexing or vector-store access control.
− Questions outside the catalog are refused rather than approximated (intended).
− At catalog scale, `suggest()` must be replaced by a retrieval implementation behind the same interface.
