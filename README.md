# cwm-mcp

MCP (Model Context Protocol) server for [Cloud World Model](https://www.cloudworldmodel.ai) — lets Claude Desktop, Cursor, and any other MCP-compatible AI assistant call the simulation platform directly via stdio.

## Installation

```bash
npm install -g "github:canvascloudai/cwm-mcp"
```

## Configuration

### Claude Desktop (`claude_desktop_config.json`)

Typically at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS:

```json
{
  "mcpServers": {
    "cloud-world-model": {
      "command": "npx",
      "args": ["cwm-mcp"],
      "env": {
        "CWM_BASE_URL": "https://www.cloudworldmodel.ai",
        "CWM_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Restart Claude Desktop after saving. The tools appear under the hammer icon in the chat interface.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `CWM_BASE_URL` | No (defaults to `http://localhost:5000`) | Base URL of the Cloud World Model API |
| `CWM_API_KEY` | Yes | API key with `write` scope. Obtain one via `POST /api/keys` on your Cloud World Model instance. |

## Available tools (20)

### Simulation

| Tool | Description |
|---|---|
| `create_simulation` | Create a virtual cloud environment with resources |
| `simulate_step` | Advance the simulation one tick and get metrics |
| `get_simulation_metrics` | Read current metrics and resource health |
| `list_simulations` | List all simulations owned by the API key |

### Reinforcement learning

| Tool | Description |
|---|---|
| `rl_create_environment` | Wrap a simulation in a Gym-compatible RL environment |
| `rl_step` | Execute one action and receive observation + reward |
| `rl_reset` | Reset the environment for a new training episode |

### Chaos engineering

| Tool | Description |
|---|---|
| `list_chaos_scenarios` | Browse pre-built failure scenarios (no auth required) |
| `chaos_run` | Inject a failure and start a resilience measurement job |
| `chaos_job_status` | Poll job progress |
| `chaos_job_results` | Retrieve the full resilience report |

### Multi-cloud strategy

| Tool | Description |
|---|---|
| `multicloud_explore` | Compare AWS/GCP/Azure/OCI/DigitalOcean strategies |
| `multicloud_job_status` | Poll job progress |
| `multicloud_job_results` | Retrieve ranked strategies with cost/latency/lock-in scores |

### Predictive scaling

| Tool | Description |
|---|---|
| `prediction_validate` | Validate infrastructure against a traffic forecast |
| `prediction_job_status` | Poll job progress |
| `prediction_job_results` | Retrieve bottleneck detections and autoscaling thresholds |

### Infrastructure optimization

| Tool | Description |
|---|---|
| `optimization_run` | Start a cost/performance/reliability optimization job |
| `optimization_job_status` | Poll job progress |
| `optimization_job_results` | Retrieve ranked recommendations with expected impact |

## Typical agent workflows

```
# RL training loop
create_simulation → rl_create_environment → [rl_step × N] → (done=true) → rl_reset → repeat

# Chaos experiment
create_simulation → chaos_run → poll chaos_job_status → chaos_job_results

# Multi-cloud comparison
multicloud_explore → poll multicloud_job_status → multicloud_job_results

# Traffic forecast validation
create_simulation → prediction_validate → poll prediction_job_status → prediction_job_results

# Cost optimization
create_simulation → optimization_run → poll optimization_job_status → optimization_job_results
```

## Building from source

```bash
git clone https://github.com/canvascloudai/cwm-mcp.git
cd cwm-mcp
npm install
npm run build
```
