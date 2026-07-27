# Changelog

All notable changes to `cwm-mcp` are documented here.

Format: [Semantic Versioning](https://semver.org) — `MAJOR.MINOR.PATCH`.  
A new npm release is cut by pushing a git tag matching `cwm-mcp/vX.Y.Z`, which triggers the GitHub Actions publish workflow.

---

## [1.1.0] — 2026-07-26

### Added
- 49 tools total (up from the original 11 in v1.0.0)
- Simulation lifecycle: `create_snapshot`, `list_snapshots`, `get_snapshot`, `simulation_claim`, `validate_accuracy`, `list_benchmarks`
- Traffic lifecycle: `create_traffic`, `update_traffic`, `delete_traffic`
- Failure lifecycle: `create_failure`, `update_failure`, `delete_failure`
- RL tools: `rl_list_environments`, `rl_get_observation`, `rl_eval_episodes`, `rl_eval_job_status`, `rl_eval_job_results`
- Compute resize: `bulk_resize`
- ESM output format (fixes Node.js ES module compatibility)
- Schema defaults for `name` and `startTime` on `create_traffic` / `create_failure`

## [1.0.0] — 2025-01-01

### Added
- Initial release with 11 core tools: `create_simulation`, `simulate_step`, `get_simulation_metrics`, `list_simulations`, `delete_simulation`, `inject_traffic`, `inject_failure`, `get_simulation_events`, `ai_explain`, `ai_troubleshoot`, `ai_analyze_bottlenecks`
