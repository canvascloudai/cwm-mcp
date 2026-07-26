# cwm-mcp

MCP (Model Context Protocol) server for [Cloud World Model](https://www.cloudworldmodel.ai) — lets Claude Desktop, Cursor, Cline, and any other MCP-compatible AI assistant call the simulation platform directly via stdio.

## Installation

```bash
npx cwm-mcp
```

Or install globally:

```bash
npm install -g cwm-mcp
```

## Configuration

### Claude Desktop — one-click install

Click the link below to install directly into Claude Desktop (macOS/Windows):

```
claude://install-mcp?name=cloud-world-model&command=npx&args=cwm-mcp&env=CWM_BASE_URL%3Dhttps%3A%2F%2Fwww.cloudworldmodel.ai,CWM_API_KEY%3Dyour-api-key-here
```

Or add manually to `claude_desktop_config.json` (typically at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

### Cursor (`.cursor/mcp.json`)

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

Reload Cursor after saving. Tools will appear in the MCP panel in the chat sidebar.

### Cline (VS Code extension)

Open the Cline extension settings → **MCP Servers** → **Edit MCP Settings**, then add:

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

Save and click **Reconnect** in the MCP Servers panel. The 49 tools will appear as available.

### Windsurf (`~/.codeium/windsurf/mcp_config.json`)

Open the global MCP config file at `~/.codeium/windsurf/mcp_config.json` (create it if it doesn't exist) and add:

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

Restart Windsurf after saving. The tools will be available to the Cascade AI assistant.

### VS Code (`.vscode/mcp.json`)

Requires **VS Code 1.99 or later** (native MCP support shipped April 2025).

Create `.vscode/mcp.json` in your project root (workspace-scoped) or add to your user `settings.json` under `"mcp"`:

```json
{
  "servers": {
    "cloud-world-model": {
      "type": "stdio",
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

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **MCP: List Servers** to confirm the server is registered. The tools will be available to GitHub Copilot and any other MCP-aware VS Code extension.

### Zed (`~/.config/zed/settings.json`)

Merge the following into your Zed settings file (open it with `zed: Open Settings` from the command palette):

```json
{
  "context_servers": {
    "cloud-world-model": {
      "command": {
        "path": "npx",
        "args": ["cwm-mcp"],
        "env": {
          "CWM_BASE_URL": "https://www.cloudworldmodel.ai",
          "CWM_API_KEY": "your-api-key-here"
        }
      }
    }
  }
}
```

Restart Zed after saving. The tools will be available in the Zed AI assistant panel.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `CWM_BASE_URL` | No (defaults to `http://localhost:5000`) | Base URL of the Cloud World Model API |
| `CWM_API_KEY` | Yes | API key with `write` scope. Obtain one via `POST /api/keys` on your Cloud World Model instance. |

## Available tools (49)

### Discovery

| Tool | Description |
|---|---|
| `get_api_spec` | Return the OpenAPI spec URL and format (no auth required) |

### Simulation lifecycle

| Tool | Description |
|---|---|
| `create_simulation` | Create a virtual cloud environment with resources |
| `simulate_step` | Advance the simulation one tick and get metrics |
| `get_simulation_metrics` | Read current metrics and resource health |
| `list_simulations` | List all simulations owned by the API key |
| `delete_simulation` | Permanently delete a simulation and its data |
| `simulation_claim` | Claim ownership of an anonymous simulation with your API key |
| `bulk_resize` | Resize all compute nodes to a new droplet size in one call (DigitalOcean) |

### Simulation state & snapshots

| Tool | Description |
|---|---|
| `create_snapshot` | Pin the current simulation state for later comparison |
| `list_snapshots` | List all pinned snapshots for a simulation |
| `get_snapshot` | Retrieve a specific pinned snapshot by pin ID |
| `get_simulation_events` | Retrieve the full ordered event log |

### Traffic management

| Tool | Description |
|---|---|
| `inject_traffic` | Spike traffic (or advance an active ramp pattern) |
| `create_traffic` | Create a persistent, named traffic pattern (ramp/burst/step/wave/spike) |
| `update_traffic` | Update an existing traffic pattern by patternId |
| `delete_traffic` | Delete a traffic pattern permanently |

### Failure management

| Tool | Description |
|---|---|
| `inject_failure` | Randomly fail one healthy compute node |
| `create_failure` | Inject a typed, persistent failure (instance_kill/az_outage/database_overload/network_latency) |
| `update_failure` | Update a failure injection (e.g. deactivate without deleting) |
| `delete_failure` | Delete a failure injection permanently |

### Accuracy validation

| Tool | Description |
|---|---|
| `validate_accuracy` | Validate simulation cost and performance accuracy against real-world reference data |
| `list_benchmarks` | List accuracy benchmark scores for AWS 6th-gen instance types |

### AI analysis

| Tool | Description |
|---|---|
| `ai_explain` | GPT-powered explanation of current simulation behavior |
| `ai_troubleshoot` | AI-backed troubleshooting guidance for a described issue |
| `ai_analyze_bottlenecks` | Detect and rank resource bottlenecks with remediation suggestions |
| `ai_optimize` | Generate AI-powered infrastructure optimization recommendations |

### Reinforcement learning

| Tool | Description |
|---|---|
| `rl_create_environment` | Wrap a simulation in a Gym-compatible RL environment |
| `rl_step` | Execute one action and receive observation + reward |
| `rl_reset` | Reset the environment for a new training episode |
| `rl_batch_step` | Execute multiple actions in one call (optimised for high-throughput training) |
| `rl_list_environments` | List all RL environments owned by the API key |
| `rl_get_observation` | Poll the current observation vector without advancing the episode |
| `rl_eval_episodes` | Replay ordered action sequences to benchmark a trained policy |
| `rl_eval_job_status` | Poll the status of an async eval job |
| `rl_eval_job_results` | Retrieve the full per-episode rewards from a completed eval job |

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
| `prediction_optimize_thresholds` | Derive recommended autoscaling thresholds from a traffic forecast |
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

# Eval a trained policy (async)
create_simulation → rl_create_environment → rl_eval_episodes → poll rl_eval_job_status → rl_eval_job_results

# Chaos experiment
create_simulation → chaos_run → poll chaos_job_status → chaos_job_results

# Multi-cloud comparison
multicloud_explore → poll multicloud_job_status → multicloud_job_results

# Traffic forecast validation
create_simulation → prediction_validate → poll prediction_job_status → prediction_job_results

# Threshold optimisation
create_simulation → prediction_optimize_thresholds → poll prediction_job_status → prediction_job_results

# Cost optimization
create_simulation → optimization_run → poll optimization_job_status → optimization_job_results

# AI-backed analysis and recommendations
create_simulation → [simulate_step × N] → ai_analyze_bottlenecks → ai_optimize
create_simulation → inject_failure → ai_troubleshoot
create_simulation → create_snapshot → [simulate_step × N] → create_snapshot → get_snapshot (diff before/after)

# Accuracy check before using sim output for production decisions
create_simulation → [simulate_step × N] → validate_accuracy

# Typed failure lifecycle
create_simulation → create_failure → [simulate_step × N] → update_failure (deactivate) → delete_failure

# Persistent traffic pattern lifecycle
create_simulation → create_traffic (ramp) → [simulate_step × N] → update_traffic → delete_traffic
```

## Building from source

```bash
git clone https://github.com/canvascloudai/cwm-mcp.git
cd cwm-mcp
npm install
npm run build
```
