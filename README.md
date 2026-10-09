# Cloud World Model MCP Server

Cloud World Model is a hosted streamable HTTP MCP server that lets coding agents simulate cloud infrastructure and estimate cost, latency, errors and resilience before deploying or changing infrastructure. It covers AWS, GCP, Azure, OCI and DigitalOcean. Simulations don't create resources in your cloud account.

[Open the MCP quickstart](https://www.cloudworldmodel.ai/mcp-quickstart).

MCP and REST are access interfaces; x402 is payment for eligible REST requests, not MCP calls. The hosted endpoint provides 63 authenticated tools and 9 keyless demo tools.

## CPU and latency evidence

`simulation.create` accepts **root-level, immutable** `appWeight: "lean" | "typical" | "heavy"`.
Omitting it selects typical and records `appWeightDefaulted: true`; explicit typical
has identical predictions. Create, step and metrics/history retain
`predictionEvidence.version: 1` in compact and full responses. The level describes
the prediction's basis, not a claim that a simulated output was observed.

- **Measured:** lean, exact eligible AWS CRUD topology, 10–1,000 offered RPS, no outage.
- **Scaled from measured:** lean proportional AWS M5 vCPU/RAM scaling or the exact
  graph above the measured load. No measurement on another size is claimed.
- **Reference estimate:** typical/heavy, other providers/families, incomplete graphs
  and active failures. Typical anchors are placeholder guidance, not official AWS
  CPU/latency references; heavy is an unsupported product assumption.

At 100 total RPS across two m5.large hosts (50 per server), typical targets 20% CPU,
P50 18.5 ms and P95 45 ms; lean is ~1.9% CPU. CPU uses
`(0.22333 + k * 0.033548 * routedAppRps) * 2 / catalogVcpu`,
with `k=1` for lean, `(20-0.22333)/(50*0.033548)` for typical and twice that for heavy.
Never divide goodput or DB/network traffic to obtain routed application RPS.
Latency starts from the owned linear lean fits, floored at P50 1.45/P95 3.10 ms;
typical multiplies these by `18.5/2.40` and `45/4.25`, heavy twice those factors.
Topology/failure/congestion penalties remain; P99 is not calibrated. These are
internal/in-VPC LB baselines, not universal end-to-end or cross-provider measurements.

The low/central/high values are **assumption intervals, not confidence intervals**:
measured 0.65–1.35×; scaled CPU 0.40–1.60× and latency 0.50–1.50×;
reference 0.50–2×. Above 1,000 RPS scaled widens to 0.25–2× and reference to
0.25–3×; never measured. CPU is clamped to 0–100%. `appCpu` averages serving
app-host CPU, not aggregate `cpuUsage`; no app means null and an empty resource array.
Source/formula IDs accompany every new result. Historical missing evidence is
explicitly `unavailable/legacy`, not retroactively measured.

Residual generic categories are custom/unrecognized SKUs without verified vCPU,
opaque Kubernetes pools, serverless tasks without a trustworthy serving-vCPU and
routing denominator, GPU token/inference/training metrics, and DB/network-only
graphs. Such unverified fallback has **no external reference**, includes
`cwm-legacy-generic-unverified`, and uses the widest reference interval.
Scaling host vCPU does not establish single-process Node request capacity; the
observed ~51% CPU app-bound holdout is not a universal CPU cap.

Owned campaign `473f1339-f712-4096-96d6-3d4fc07cb427`, revision `117051b`,
measurement `7416cb63`, supports only the existing lean fit/holdout.
Accuracy comparisons explicitly choose lean; non-AWS benchmark-only compatibility
preserves existing scores and citations, not generic self-serve behavior.
Prediction hashes include weight/model revision separately from replay-input hashes.

### Citing and reproducing simulation evidence

For a claim about measured accuracy, cite the [accuracy benchmark](https://www.cloudworldmodel.ai/accuracy)
and its public [data endpoint](https://www.cloudworldmodel.ai/api/accuracy-benchmark),
not a single simulated result as if it were an observation. The owned measurement
is scoped to an ALB → two m5.large app hosts → db.r5.large RDS MySQL Single-AZ
graph in AWS us-east-2 at 10, 100, 500 and 1,000 offered RPS. The accuracy
comparison covers app-host CPU, in-VPC internal-LB latency, goodput and CRUD
errors; cost uses AWS us-east-2 price-list data rather than a measured invoice.
See [simulation fidelity](https://www.cloudworldmodel.ai/fidelity) for source
and coverage notes and the [benchmark report](https://www.cloudworldmodel.ai/benchmark)
for provider comparisons. Neither establishes measured accuracy for every topology.

To inspect the published evidence independently, retrieve the public benchmark
response and record the campaign/revision, workload, region, load, metric and
fit/holdout provenance alongside any quoted result:

```bash
curl -fsS https://www.cloudworldmodel.ai/api/accuracy-benchmark
```

To compare a local MCP run, set `appWeight: "lean"` on `simulation.create`,
keep the graph, region and offered load aligned with the cited benchmark, and
retain `predictionEvidence` and the prediction/replay-input hashes in your
record. Label outputs `measured`, `scaled from measured`, or `reference estimate`
as reported; do not promote scaled or reference estimates to measurements.
Simulation steps are predictions, not a rerun of the owned AWS campaign.
The [docs hub](https://www.cloudworldmodel.ai/docs) and
[multi-cloud simulation guide](https://www.cloudworldmodel.ai/guides/pre-provision-multi-cloud-simulation)
provide further orientation.

## Connect to the hosted server

Endpoint: `https://www.cloudworldmodel.ai/mcp`

For an API-key connection, send `x-api-key: <api-key>` on initialization and
every subsequent session request, including GET and DELETE. Without a key, 9 keyless demo tools are
available; an API key unlocks all 63 authenticated tools. Invalid credentials
return HTTP 401 rather than opening a demo session.

### Claude Desktop

Add the following remote server entry to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cloud-world-model": {
      "type": "http",
      "url": "https://www.cloudworldmodel.ai/mcp",
      "headers": { "x-api-key": "<your CWM API key>" }
    }
  }
}
```

Claude Code can connect with:

```bash
claude mcp add --transport http cloud-world-model https://www.cloudworldmodel.ai/mcp --header "x-api-key: <your CWM API key>"
```

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "cloud-world-model": {
      "url": "https://www.cloudworldmodel.ai/mcp",
      "headers": { "x-api-key": "<your CWM API key>" }
    }
  }
}
```

### Generic remote MCP client

Configure the hosted Streamable HTTP URL and, when authenticated, the API-key
header. Omit `headers` to use the keyless demo tools:

```json
{
  "url": "https://www.cloudworldmodel.ai/mcp",
  "headers": { "x-api-key": "<your CWM API key>" }
}
```

Create an API key at https://www.cloudworldmodel.ai/getting-started.


<!-- BEGIN GENERATED MCP TOOL TABLE -->
## Available tools (63)

The 9 keyless demo tools are marked. All other tools require an API key.

> **REST-only x402 operation:** `POST /api/simulations/stateless` is intentionally
> not an MCP tool. MCP invocation cannot preserve the HTTP 402 challenge,
> Base/Solana payment-header selection, settlement response, and exact-once
> payment replay boundary end to end. The MCP tool counts therefore remain
> unchanged.

| Tool | Access | Registry title |
|---|---|---|
| `api.spec` | API key | Get API Spec |
| `simulation.create` | Keyless demo (also API key) | Create Simulation |
| `simulation.update` | API key | Update Simulation |
| `simulation.step` | Keyless demo (also API key) | Simulate Step |
| `simulation.metrics` | Keyless demo (also API key) | Get Simulation Metrics |
| `simulation.cost_breakdown` | API key | Get Per-Resource Cost Breakdown |
| `simulation.list` | API key | List Simulations |
| `simulation.get` | API key | Get Simulation |
| `simulation.provider_api_limits` | API key | Simulate Provider API Limits |
| `rl.create` | API key | Create RL Environment |
| `rl.step` | API key | RL Step |
| `rl.validate_policy` | API key | Validate Action Policy (Dev) |
| `rl.reset` | API key | Reset RL Environment |
| `rl.batch_step` | API key | RL Batch Step |
| `chaos.scenarios` | API key | List Chaos Scenarios |
| `chaos.run` | API key | Run Chaos Experiment |
| `chaos.status` | API key | Chaos Job Status |
| `chaos.results` | API key | Chaos Job Results |
| `multicloud.explore` | API key | Multi-Cloud Explore |
| `multicloud.status` | API key | Multi-Cloud Job Status |
| `multicloud.results` | API key | Multi-Cloud Job Results |
| `multicloud.verdict` | API key | Finalize Pre-Provision Verdict |
| `prediction.validate` | API key | Prediction Validate |
| `prediction.status` | API key | Prediction Job Status |
| `prediction.results` | API key | Prediction Job Results |
| `optimization.run` | API key | Run Optimization Job |
| `optimization.status` | API key | Optimization Job Status |
| `optimization.results` | API key | Optimization Job Results |
| `prediction.optimize_thresholds` | API key | Prediction Optimize Thresholds |
| `simulation.inject_traffic` | Keyless demo (also API key) | Inject Traffic |
| `simulation.inject_failure` | Keyless demo (also API key) | Inject Failure |
| `simulation.events` | API key | Get Simulation Events |
| `simulation.delete` | Keyless demo (also API key) | Delete Simulation |
| `snapshot.create` | API key | Create Snapshot |
| `snapshot.list` | API key | List Snapshots |
| `snapshot.get` | API key | Get Snapshot |
| `ai.explain` | API key | AI Explain |
| `ai.troubleshoot` | API key | AI Troubleshoot |
| `ai.analyze` | API key | AI Analyze Bottlenecks |
| `ai.status` | API key | AI Job Status |
| `ai.results` | API key | AI Job Results |
| `rl.list` | API key | List RL Environments |
| `rl.observation` | API key | Get RL Observation |
| `rl.eval` | API key | Evaluate RL Episodes |
| `rl.eval_status` | API key | RL Eval Job Status |
| `rl.eval_results` | API key | RL Eval Job Results |
| `ai.optimize` | API key | AI Optimize |
| `traffic.create` | API key | Create Traffic Pattern |
| `traffic.update` | API key | Update Traffic Pattern |
| `traffic.delete` | API key | Delete Traffic Pattern |
| `failure.create` | API key | Create Failure Injection |
| `failure.update` | API key | Update Failure Injection |
| `failure.delete` | API key | Delete Failure Injection |
| `simulation.resize` | API key | Bulk Resize Compute |
| `simulation.recover_resource` | Keyless demo (also API key) | Recover Failed Resource |
| `simulation.claim` | API key | Claim Simulation |
| `benchmark.validate` | API key | Validate Accuracy |
| `benchmark.list` | API key | List Benchmarks |
| `simulation.right_sizing_hint` | API key | Get Right-Sizing Hint |
| `simulation.apply_right_sizing` | API key | Apply Right-Sizing Hint |
| `scenario.list` | Keyless demo (also API key) | List Scenarios |
| `scenario.get` | Keyless demo (also API key) | Get Scenario |
| `simulation.compare_resilience` | API key | Compare Resilience Configurations |
<!-- END GENERATED MCP TOOL TABLE -->
## Typical agent workflows

```
# RL training loop
simulation.create → rl.create → [rl.step × N] → (done=true) → rl.reset → repeat

# Eval a trained policy (async)
simulation.create → rl.create → rl.eval → poll rl.eval_status → rl.eval_results

# Chaos experiment
simulation.create → chaos.run → poll chaos.status → chaos.results

# Multi-cloud comparison
multicloud.explore → poll multicloud.status → multicloud.results

# Traffic forecast validation
simulation.create → prediction.validate → poll prediction.status → prediction.results

# Threshold optimisation
simulation.create → prediction.optimize_thresholds → poll prediction.status → prediction.results

# Cost optimization
simulation.create → optimization.run → poll optimization.status → optimization.results

# AI-backed analysis and recommendations
simulation.create → [simulation.step × N] → ai.analyze → ai.optimize
simulation.create → simulation.inject_failure → ai.troubleshoot
simulation.create → snapshot.create → [simulation.step × N] → snapshot.create → snapshot.get (diff before/after)

# Accuracy check before using sim output for production decisions
simulation.create → [simulation.step × N] → benchmark.validate

# Typed failure lifecycle
simulation.create → failure.create → [simulation.step × N] → failure.update (deactivate) → failure.delete

# Persistent traffic pattern lifecycle
simulation.create → traffic.create (ramp) → [simulation.step × N] → traffic.update → traffic.delete
```

## Building from source (for contributors)

This builds the source repository; MCP clients should use the hosted URL above.

```bash
git clone https://github.com/canvascloudai/cwm-mcp.git
cd cwm-mcp
npm install
npm run build
```
