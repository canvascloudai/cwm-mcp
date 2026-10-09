# Changelog

All notable changes to `cwm-mcp` are documented here.

Format: [Semantic Versioning](https://semver.org) — `MAJOR.MINOR.PATCH`.  
A new npm release is cut by pushing a git tag matching `cwm-mcp/vX.Y.Z`, which triggers the GitHub Actions publish workflow.

---

## Unreleased — workload evidence

- `simulation.create` accepts immutable root `appWeight` (`lean`, `typical`, `heavy`).
  Omission means typical and preserves `appWeightDefaulted=true`.
- Create, step and metrics (including history), compact and full, expose versioned
  `predictionEvidence`: per-quantity provenance, sources, formulas and assumption
  intervals, not statistical confidence intervals. Legacy rows are explicitly unavailable.
- Two m5.large apps at 100 total RPS (50 per server) now target ~20% CPU with typical
  weight, versus the deliberately lean benchmark's ~1.9%. Typical anchors are
  placeholder guidance; heavy is an unsupported product assumption, not AWS evidence.
- Lean owned four-rung predictions remain unchanged. Known-vCPU shapes use the
  reference model; proportional lean M5 scaling does not claim measurement on
  another size. Above 1,000 RPS evidence is never measured and ranges widen.
- Accuracy comparisons explicitly select lean; non-AWS benchmark compatibility
  intentionally preserves existing scores, not self-serve generic predictions.

## [1.1.0] — 2026-07-26

### Added
- 49 tools total (up from the original 11 in v1.0.0)
- Simulation lifecycle: `snapshot.create`, `snapshot.list`, `snapshot.get`, `simulation.claim`, `benchmark.validate`, `benchmark.list`
- Traffic lifecycle: `traffic.create`, `traffic.update`, `traffic.delete`
- Failure lifecycle: `failure.create`, `failure.update`, `failure.delete`
- RL tools: `rl.list`, `rl.observation`, `rl.eval`, `rl.eval_status`, `rl.eval_results`
- Compute resize: `simulation.resize`
- ESM output format (fixes Node.js ES module compatibility)
- Schema defaults for `name` and `startTime` on `traffic.create` / `failure.create`

## [1.0.0] — 2025-01-01

### Added
- Initial release with 11 core tools: `simulation.create`, `simulation.step`, `simulation.metrics`, `simulation.list`, `simulation.delete`, `simulation.inject_traffic`, `simulation.inject_failure`, `simulation.events`, `ai.explain`, `ai.troubleshoot`, `ai.analyze`
