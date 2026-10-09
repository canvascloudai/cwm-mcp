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


## Available tools (63)

> **REST-only x402 operation:** `POST /api/simulations/stateless` is intentionally
> not an MCP tool. MCP invocation cannot preserve the HTTP 402 challenge,
> Base/Solana payment-header selection, settlement response, and exact-once
> payment replay boundary end to end. The MCP tool counts therefore remain
> unchanged.

## Available tools (63)

### Discovery

| Tool | Description |
|---|---|
| `api.spec` | Return the OpenAPI spec URL and format (no auth required) |

### Simulation lifecycle

| Tool | Description |
|---|---|
| `simulation.create` | Create a virtual cloud environment with resources |
| `simulation.step` | Advance the simulation one tick and get metrics |
| `simulation.metrics` | Read current metrics and resource health |
| `simulation.provider_api_limits` | Simulate bounded provider quotas, throttling, retries, queueing, and concurrency with catalog/override provenance; does not call a cloud API or advance `/step` |
| `simulation.cost_breakdown` | Latest per-resource hourly cost with status — spot zombie/residual billing |
| `simulation.list` | List all simulations owned by the API key |
| `simulation.delete` | Permanently delete a simulation and its data |
| `simulation.claim` | Claim ownership of an anonymous simulation with your API key |
| `simulation.resize` | Resize all compute nodes to a new droplet size in one call (DigitalOcean-only; never use for failure recovery) |
| `simulation.recover_resource` | Recover a single failed resource by name or ID (any provider); response echoes lower-bound `stepsToHealthy` and tells callers to poll until healthy |

### Simulation state & snapshots

| Tool | Description |
|---|---|
| `snapshot.create` | Pin the current simulation state for later comparison |
| `snapshot.list` | List all pinned snapshots for a simulation |
| `snapshot.get` | Retrieve a specific pinned snapshot by pin ID |
| `simulation.events` | Retrieve the full ordered event log |

### Traffic management

| Tool | Description |
|---|---|
| `simulation.inject_traffic` | Spike traffic (or advance an active ramp pattern) |
| `traffic.create` | Create a persistent, named traffic pattern (ramp/burst/step/wave/spike) |
| `traffic.update` | Update an existing traffic pattern by patternId |
| `traffic.delete` | Delete a traffic pattern permanently |

### Failure management

| Tool | Description |
|---|---|
| `simulation.inject_failure` | Randomly fail one healthy compute node |
| `failure.create` | Inject a typed, persistent failure (instance_kill/instance_down/az_outage/database_overload/network_latency/spot_interruption); `spot_interruption` is the bounded 120-second AWS EKS migration lifecycle |
| `failure.update` | Update a failure injection (e.g. deactivate without deleting) |
| `failure.delete` | Delete a failure injection permanently |

### Accuracy validation

| Tool | Description |
|---|---|
| `benchmark.validate` | Validate simulation cost and performance accuracy against real-world reference data |
| `benchmark.list` | List accuracy benchmark scores for AWS 6th-gen instance types |

### AI analysis

| Tool | Description |
|---|---|
| `ai.explain` | GPT-powered explanation of current simulation behavior |
| `ai.troubleshoot` | AI-backed troubleshooting guidance for a described issue |
| `ai.analyze` | Detect and rank resource bottlenecks with remediation suggestions |
| `ai.optimize` | Generate AI-powered infrastructure optimization recommendations |

### Reinforcement learning

| Tool | Description |
|---|---|
| `rl.create` | Wrap a simulation in a Gym-compatible RL environment |
| `rl.step` | Execute one action and receive observation + reward |
| `rl.reset` | Reset the environment for a new training episode |
| `rl.batch_step` | Execute multiple actions in one call (optimised for high-throughput training) |
| `rl.list` | List all RL environments owned by the API key |
| `rl.observation` | Poll the current observation vector without advancing the episode |
| `rl.eval` | Replay ordered action sequences to benchmark a trained policy |
| `rl.eval_status` | Poll the status of an async eval job |
| `rl.eval_results` | Retrieve the full per-episode rewards from a completed eval job |

### Chaos engineering

| Tool | Description |
|---|---|
| `chaos.scenarios` | Browse pre-built failure scenarios (no auth required) |
| `chaos.run` | Inject a failure and start a resilience measurement job |
| `chaos.status` | Poll job progress |
| `chaos.results` | Retrieve the full resilience report |

### Multi-cloud strategy

| Tool | Description |
|---|---|
| `multicloud.explore` | Compare AWS/GCP/Azure/OCI/DigitalOcean strategies |
| `multicloud.status` | Poll job progress |
| `multicloud.results` | Retrieve ranked strategies with cost/latency/lock-in scores |
| `multicloud.verdict` | Inspect a candidate fingerprint, then evaluate completed caller-attested resilience evidence for those exact test inputs. Ship requires all checks to pass; estimated evidence is insufficient. Reports are not independently verified or persisted. |

### Predictive scaling

| Tool | Description |
|---|---|
| `prediction.validate` | Validate infrastructure against a traffic forecast |
| `prediction.optimize_thresholds` | Derive recommended autoscaling thresholds from a traffic forecast |
| `prediction.status` | Poll job progress |
| `prediction.results` | Retrieve bottleneck detections and autoscaling thresholds |

### Infrastructure optimization

| Tool | Description |
|---|---|
| `optimization.run` | Start a cost/performance/reliability optimization job |
| `optimization.status` | Poll job progress |
| `optimization.results` | Retrieve ranked recommendations with expected impact |

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
