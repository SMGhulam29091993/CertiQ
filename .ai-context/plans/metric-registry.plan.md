# Plan: Certified metric registry
## Derived From
.ai-context/specs/metric-registry.spec.md
## Architecture Approach
`IMetricRegistry` + `RegistryFileSchema` in contracts; `YamlMetricRegistry` in semantic-layer with
`fromFile`/`fromYaml` factories and a private `assertIntegrity()`. `suggest()` = token overlap over
id/label/synonyms.
## Data Model
`metrics.yaml` (registry_version, dimensions[], metrics[]). No DB tables.
## Constitution Check
- [x] No new datastore — YAML in repo, reviewed like code
- [x] Tests colocated; real file loaded in tests
- [x] Identifiers regex-validated (Security Posture)
## Explicitly Deferred
- Embedding retrieval for `suggest()` — ADR-0001 (only at catalog scale)
## Sequencing
1. Contracts → 2. Registry class → 3. metrics.yaml v1 → 4. Tests
