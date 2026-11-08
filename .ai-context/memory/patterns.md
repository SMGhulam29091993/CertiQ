# patterns.md — reusable pattern seen in 2+ places

### Generate the contract from the registry, never hand-copy it
**Where used:** certified-metric-tool (tool JSON Schema `enum`s), ask-console (catalog panel), eval-harness (ground truth via the tool)
**Shape:** anything that lists metrics or dimensions reads `IMetricRegistry` at runtime, so adding a metric to `metrics.yaml` updates the tool schema, UI and evals with no other edit.
