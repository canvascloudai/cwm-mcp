#!/usr/bin/env node

// index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
var BASE_URL = process.env.CWM_BASE_URL ?? "http://localhost:5000";
var API_KEY = process.env.CWM_API_KEY ?? "";
async function apiCall(method, path, body, requireAuth = false) {
  const headers = { "Content-Type": "application/json" };
  if (requireAuth) {
    if (!API_KEY) {
      throw new Error(
        "CWM_API_KEY environment variable is required for this tool. Set it to a valid API key obtained from POST /api/keys on your Cloud World Model instance."
      );
    }
    headers["Authorization"] = `Bearer ${API_KEY}`;
  } else if (API_KEY) {
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== void 0 ? JSON.stringify(body) : void 0
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const errMsg = typeof data === "object" && data !== null && "error" in data ? data.error : text;
    throw new Error(`API error ${res.status}: ${errMsg}`);
  }
  return data;
}
var server = new McpServer({
  name: "cloud-world-model",
  version: "1.1.0"
});
server.tool(
  "get_api_spec",
  "Return the location and format of the Cloud World Model OpenAPI specification. openapi_spec_url: /api-docs/openapi.json \u2014 fetch this path relative to the server base URL to retrieve the full machine-readable spec. openapi_spec_format: openapi3_json \u2014 the spec is an OpenAPI 3.0 document in JSON format. Invoking this tool resolves the absolute URL against the configured server base and includes a usage description. No API key required.",
  {},
  () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              openapi_spec_url: `${BASE_URL}/api-docs/openapi.json`,
              openapi_spec_format: "openapi3_json",
              description: "Fetch openapi_spec_url to retrieve the full OpenAPI 3.0 specification in JSON format. It documents every REST endpoint, request schema, response schema, and authentication requirement for this Cloud World Model instance."
            },
            null,
            2
          )
        }
      ]
    };
  }
);
server.tool(
  "create_simulation",
  "Create a new virtual cloud environment (simulation) with resources such as compute, database, storage, network, cache, queue, or kubernetes nodes. Returns the created simulation object including its id, which is required for subsequent calls. Requires CWM_API_KEY with write scope.",
  {
    name: z.string().describe("Human-readable name for the simulation"),
    description: z.string().optional().describe("Optional description of the simulation scenario"),
    resources: z.array(
      z.object({
        id: z.string().describe("Unique identifier for this resource within the simulation"),
        type: z.enum(["compute", "database", "storage", "network", "cache", "queue", "kubernetes"]).describe("Resource category"),
        name: z.string().describe("Display name for the resource"),
        provider: z.enum(["aws", "gcp", "azure", "oci", "digitalocean"]).default("aws").describe("Cloud provider"),
        characteristics: z.object({
          size: z.string().optional().describe("Instance/resource size, e.g. t3.medium, n1-standard-2"),
          maxThroughput: z.number().optional().describe("Max requests per second"),
          maxConnections: z.number().optional().describe("Max concurrent connections"),
          autoscaling: z.boolean().optional().describe("Whether autoscaling is enabled")
        }).optional().describe("Provider-specific resource characteristics")
      })
    ).describe("List of cloud resources composing this simulation"),
    connections: z.array(
      z.object({
        sourceId: z.string(),
        targetId: z.string(),
        label: z.string().optional()
      })
    ).optional().describe("Directed connections between resources (e.g. web server \u2192 database)"),
    traffic: z.number().default(0).describe("Initial traffic level in requests per second (0\u2013100 scale)")
  },
  async (args) => {
    try {
      const result = await apiCall(
        "POST",
        "/api/simulations",
        { ...args, connections: args.connections ?? [] },
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "simulate_step",
  "Advance a simulation by one time step and return updated metrics (CPU, latency, throughput, error rate, cost). Use this to drive the simulation forward and observe system behaviour over time. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the simulation to step (from create_simulation)"),
    traffic: z.number().min(0).optional().describe("Optional traffic override in RPS for this step. Omit to use the simulation's current traffic.")
  },
  async (args) => {
    try {
      const body = {};
      if (args.traffic !== void 0) body.traffic = args.traffic;
      const result = await apiCall("POST", `/api/simulations/${args.simulationId}/step`, body, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "get_simulation_metrics",
  "Read the latest metrics and resource states for an existing simulation. Returns latency (P50/P95/P99), CPU usage, memory, throughput, error rate, cost per hour, and per-resource health. Requires CWM_API_KEY with read scope.",
  {
    simulationId: z.string().describe("ID of the simulation to query")
  },
  async (args) => {
    try {
      const [simulation, metrics] = await Promise.all([
        apiCall("GET", `/api/simulations/${args.simulationId}`, void 0, true),
        apiCall("GET", `/api/simulations/${args.simulationId}/metrics`, void 0, true)
      ]);
      return {
        content: [{ type: "text", text: JSON.stringify({ simulation, metrics }, null, 2) }]
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "list_simulations",
  "List all simulations owned by the current API key. Returns simulation IDs, names, resource counts, and status. Use the returned IDs with simulate_step, get_simulation_metrics, rl_create_environment, chaos_run, or multicloud_explore. Requires CWM_API_KEY with read scope.",
  {},
  async () => {
    try {
      const result = await apiCall("GET", "/api/simulations", void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "rl_create_environment",
  "Create a Gym-compatible reinforcement learning training environment linked to a simulation. Returns an initial observation vector and an environment id for use with rl_step. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the simulation to wrap as an RL environment"),
    maxSteps: z.number().int().min(1).max(1e4).default(300).describe("Maximum number of steps per episode (1\u201310000, default 300)"),
    initialTraffic: z.number().min(0).default(1e4).describe("Initial traffic load at the start of each episode in RPS (default 10000)"),
    targetTrafficPattern: z.enum(["ramp", "burst", "step", "wave", "custom"]).optional().describe("Traffic pattern to apply during training episodes"),
    maxLatencyP95Ms: z.number().min(0).default(200).describe("SLA target: maximum P95 latency in milliseconds (default 200)"),
    maxErrorRatePercent: z.number().min(0).max(100).default(1).describe("SLA target: maximum acceptable error rate in percent (default 1)"),
    costBudgetPerHour: z.number().min(0).optional().describe("Optional cost budget in USD per simulated hour. Episodes that exceed this budget incur negative reward."),
    enableFailures: z.boolean().default(false).describe("Whether to randomly inject failures during training episodes (default false)"),
    tickSeconds: z.number().int().min(1).default(3600).describe("Simulated seconds per environment tick (default 3600 = 1 hour). Controls the time-scale of cost and traffic patterns.")
  },
  async (args) => {
    try {
      const episodeConfig = {
        maxSteps: args.maxSteps,
        initialTraffic: args.initialTraffic,
        targetSLA: {
          maxLatencyP95: args.maxLatencyP95Ms,
          maxErrorRate: args.maxErrorRatePercent
        },
        enableFailures: args.enableFailures,
        tickSeconds: args.tickSeconds
      };
      if (args.targetTrafficPattern) episodeConfig.targetTrafficPattern = args.targetTrafficPattern;
      if (args.costBudgetPerHour !== void 0) episodeConfig.costBudgetPerHour = args.costBudgetPerHour;
      const result = await apiCall(
        "POST",
        "/api/rl/environments",
        { simulationId: args.simulationId, episodeConfig },
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "rl_step",
  "Execute one RL action in a training environment and receive the next observation, reward, done flag, and diagnostic info. When done=true, call rl_reset to start a new episode. Requires CWM_API_KEY with write scope.\n\nAction types:\n- scale_out: add compute instances\n- scale_in: remove compute instances\n- add_resource: add a new resource node\n- remove_resource: remove a resource node\n- adjust_threshold: change autoscaling CPU/latency/throughput thresholds\n- set_recovery_policy: set per-resource recovery thresholds (requires resourceId + criticalCpuThreshold/criticalSteps/warningCpuThreshold/warningSteps)",
  {
    environmentId: z.string().describe("ID of the RL environment (from rl_create_environment)"),
    actionType: z.enum(["adjust_threshold", "scale_out", "scale_in", "add_resource", "remove_resource", "set_recovery_policy"]).describe("Type of autoscaling action to apply"),
    resourceId: z.string().optional().describe("ID of the specific resource to target. Required for add_resource, remove_resource, and set_recovery_policy."),
    instanceCount: z.number().int().min(1).optional().describe("Number of instances to add or remove (for scale_out / scale_in)"),
    cpuThreshold: z.number().min(0).max(100).optional().describe("New CPU scale-out threshold in percent (for adjust_threshold)"),
    latencyThreshold: z.number().min(0).optional().describe("New latency threshold in milliseconds (for adjust_threshold)"),
    resourceType: z.enum(["compute", "database", "storage", "network"]).optional().describe("Type of resource to add (for add_resource)"),
    provider: z.enum(["aws", "gcp", "azure", "oci", "digitalocean"]).optional().describe("Cloud provider for the new resource (for add_resource)"),
    tick_seconds: z.number().int().min(1).max(3600).optional().describe("Simulated seconds per step (1\u20133600). Overrides the environment default for this step only. Useful for warm-up phases (small values) vs. long-horizon training (large values)."),
    criticalCpuThreshold: z.number().min(0).max(100).optional().describe("CPU % above which a resource is considered critical (for set_recovery_policy). Default 80."),
    criticalSteps: z.number().int().min(1).optional().describe("Steps the resource must stay at critical CPU before recovery triggers (for set_recovery_policy). Default 4."),
    warningCpuThreshold: z.number().min(0).max(100).optional().describe("CPU % above which a resource is considered in warning state (for set_recovery_policy). Default 70."),
    warningSteps: z.number().int().min(1).optional().describe("Steps the resource must stay at warning CPU before recovery triggers (for set_recovery_policy). Default 3.")
  },
  async (args) => {
    try {
      const parameters = {};
      if (args.resourceId !== void 0) parameters.resourceId = args.resourceId;
      if (args.instanceCount !== void 0) parameters.instanceCount = args.instanceCount;
      if (args.cpuThreshold !== void 0) parameters.cpuThreshold = args.cpuThreshold;
      if (args.latencyThreshold !== void 0) parameters.latencyThreshold = args.latencyThreshold;
      if (args.resourceType !== void 0) parameters.resourceType = args.resourceType;
      if (args.provider !== void 0) parameters.provider = args.provider;
      if (args.criticalCpuThreshold !== void 0 || args.criticalSteps !== void 0 || args.warningCpuThreshold !== void 0 || args.warningSteps !== void 0) {
        parameters.recoveryPolicy = {
          criticalCpuThreshold: args.criticalCpuThreshold ?? 80,
          criticalSteps: args.criticalSteps ?? 4,
          warningCpuThreshold: args.warningCpuThreshold ?? 70,
          warningSteps: args.warningSteps ?? 3
        };
      }
      const body = { action: { type: args.actionType, parameters } };
      if (args.tick_seconds !== void 0) body.tick_seconds = args.tick_seconds;
      const result = await apiCall(
        "POST",
        `/api/rl/environments/${args.environmentId}/step`,
        body,
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "rl_reset",
  "Reset an RL environment to begin a fresh training episode. Returns the initial observation for the new episode. Call this when the done flag from rl_step is true. Requires CWM_API_KEY with write scope.",
  {
    environmentId: z.string().describe("ID of the RL environment to reset")
  },
  async (args) => {
    try {
      const result = await apiCall(
        "POST",
        `/api/rl/environments/${args.environmentId}/reset`,
        {},
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "rl_batch_step",
  "Execute up to 30 RL actions in a single round-trip. More efficient than calling rl_step repeatedly when you have a predetermined action sequence. Returns an ordered array of step results (same shape as rl_step). Execution stops early if the episode ends (done=true). Requires CWM_API_KEY with write scope.\n\nAction types per step:\n- scale_out: add compute instances\n- scale_in: remove compute instances\n- add_resource: add a new resource node\n- remove_resource: remove a resource node\n- adjust_threshold: change autoscaling CPU/latency/throughput thresholds\n- set_recovery_policy: set per-resource recovery thresholds",
  {
    environmentId: z.string().describe("ID of the RL environment (from rl_create_environment)"),
    steps: z.array(
      z.object({
        actionType: z.enum(["adjust_threshold", "scale_out", "scale_in", "add_resource", "remove_resource", "set_recovery_policy"]).describe("Type of autoscaling action to apply"),
        resourceId: z.string().optional().describe("ID of the specific resource to target"),
        instanceCount: z.number().int().min(1).optional().describe("Instances to add or remove (scale_out / scale_in)"),
        cpuThreshold: z.number().min(0).max(100).optional().describe("New CPU scale-out threshold in percent (adjust_threshold)"),
        latencyThreshold: z.number().min(0).optional().describe("New latency threshold in ms (adjust_threshold)"),
        resourceType: z.enum(["compute", "database", "storage", "network"]).optional().describe("Resource type for add_resource"),
        provider: z.enum(["aws", "gcp", "azure", "oci", "digitalocean"]).optional().describe("Cloud provider for add_resource"),
        criticalCpuThreshold: z.number().min(0).max(100).optional().describe("Critical CPU % threshold (set_recovery_policy)"),
        criticalSteps: z.number().int().min(1).optional().describe("Steps at critical before recovery triggers (set_recovery_policy)"),
        warningCpuThreshold: z.number().min(0).max(100).optional().describe("Warning CPU % threshold (set_recovery_policy)"),
        warningSteps: z.number().int().min(1).optional().describe("Steps at warning before recovery triggers (set_recovery_policy)"),
        tick_seconds: z.number().int().min(1).max(3600).optional().describe("Simulated seconds for this step (overrides environment default)")
      })
    ).min(1).max(30).describe("Ordered list of step actions to execute (1\u201330)")
  },
  async (args) => {
    try {
      const steps = args.steps.map((s) => {
        const parameters = {};
        if (s.resourceId !== void 0) parameters.resourceId = s.resourceId;
        if (s.instanceCount !== void 0) parameters.instanceCount = s.instanceCount;
        if (s.cpuThreshold !== void 0) parameters.cpuThreshold = s.cpuThreshold;
        if (s.latencyThreshold !== void 0) parameters.latencyThreshold = s.latencyThreshold;
        if (s.resourceType !== void 0) parameters.resourceType = s.resourceType;
        if (s.provider !== void 0) parameters.provider = s.provider;
        if (s.criticalCpuThreshold !== void 0 || s.criticalSteps !== void 0 || s.warningCpuThreshold !== void 0 || s.warningSteps !== void 0) {
          parameters.recoveryPolicy = {
            criticalCpuThreshold: s.criticalCpuThreshold ?? 80,
            criticalSteps: s.criticalSteps ?? 4,
            warningCpuThreshold: s.warningCpuThreshold ?? 70,
            warningSteps: s.warningSteps ?? 3
          };
        }
        const step = { action: { type: s.actionType, parameters } };
        if (s.tick_seconds !== void 0) step.tick_seconds = s.tick_seconds;
        return step;
      });
      const result = await apiCall(
        "POST",
        `/api/rl/environments/${args.environmentId}/batch-step`,
        { steps },
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "list_chaos_scenarios",
  "List all pre-built chaos engineering scenarios available on this Cloud World Model instance. Returns scenario IDs, names, descriptions, and expected outcomes. Use the returned IDs with the chaos_run tool. No API key required.",
  {},
  async () => {
    try {
      const result = await apiCall("GET", "/api/chaos/scenarios");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "chaos_run",
  "Inject a failure into a simulation and measure resilience. Returns a job ID immediately; poll chaos_job_status until completed, then retrieve the full report with chaos_job_results. Either scenarioId or customInjections must be provided. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the simulation to run chaos against"),
    scenarioId: z.string().optional().describe(
      "Pre-built chaos scenario ID (e.g. az_outage, db_crash, network_partition, cascading_failure, cpu_stress). Use list_chaos_scenarios to browse available IDs."
    ),
    customInjections: z.array(
      z.object({
        failureType: z.enum([
          "database_crash",
          "database_slowdown",
          "zone_outage",
          "instance_failure",
          "network_latency",
          "network_partition",
          "cascading_failure",
          "cpu_stress"
        ]).describe("Type of failure to inject"),
        targetResourceId: z.string().optional().describe("Specific resource to target"),
        targetZone: z.string().optional().describe("Availability zone to target"),
        intensity: z.number().min(0).max(100).optional().describe("Failure severity from 0 (minimal) to 100 (maximum)"),
        duration: z.number().optional().describe("Duration of the failure in simulation seconds")
      })
    ).optional().describe("Custom failure injections \u2014 use instead of scenarioId for fine-grained control."),
    duration: z.number().min(10).max(1e3).default(300).describe("Total chaos experiment duration in simulation seconds (10\u20131000, default 300)")
  },
  async (args) => {
    try {
      const body = {
        simulationId: args.simulationId,
        duration: args.duration
      };
      if (args.scenarioId) body.scenarioId = args.scenarioId;
      if (args.customInjections) body.customInjections = args.customInjections;
      const result = await apiCall("POST", "/api/chaos/run", body, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "chaos_job_status",
  "Poll the status of a chaos job. Status lifecycle: pending \u2192 running \u2192 completed | failed | cancelled. When status is 'completed', call chaos_job_results for the full resilience report. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Chaos job ID returned by chaos_run")
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/chaos/jobs/${args.jobId}`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "chaos_job_results",
  "Retrieve the full resilience report for a completed chaos job. Includes: overall resilience score (0\u2013100), letter grade (A\u2013F), score breakdown by recovery/availability/data-integrity/graceful-degradation, discovered vulnerabilities with severity and remediation advice, and a timeline of events. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Chaos job ID returned by chaos_run")
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/chaos/jobs/${args.jobId}/results`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "multicloud_explore",
  "Generate and score multi-cloud deployment strategies for a workload. Compares AWS, GCP, Azure, OCI, and DigitalOcean combinations across cost, latency, and vendor lock-in. Returns a job ID immediately; poll multicloud_job_status then call multicloud_job_results for ranked strategies. Requires CWM_API_KEY with write scope.",
  {
    computeInstances: z.number().int().min(1).describe("Number of compute instances in the workload"),
    databaseInstances: z.number().int().min(1).describe("Number of database instances"),
    storageGB: z.number().min(1).describe("Total storage required in GB"),
    trafficRPS: z.number().min(1).describe("Average requests per second"),
    latencyRequirementMs: z.number().min(1).describe("Maximum acceptable P95 latency in milliseconds (your SLA)"),
    primaryRegion: z.string().describe(
      "Primary deployment region, e.g. 'us-east-1', 'us-central1', 'eastus'. This is the main region where most traffic originates."
    ),
    secondaryRegions: z.array(z.string()).optional().describe("Optional list of secondary/failover regions"),
    requiresMultiRegion: z.boolean().optional().describe("Whether the architecture must span multiple regions (default false)"),
    costWeight: z.number().min(0).max(1).default(0.4).describe("Optimization weight for minimizing cost (0\u20131, default 0.4)"),
    latencyWeight: z.number().min(0).max(1).default(0.4).describe("Optimization weight for minimizing latency (0\u20131, default 0.4)"),
    vendorLockInWeight: z.number().min(0).max(1).default(0.2).describe("Optimization weight for minimizing vendor lock-in risk (0\u20131, default 0.2)")
  },
  async (args) => {
    try {
      const result = await apiCall(
        "POST",
        "/api/multi-cloud/explore",
        {
          workloadProfile: {
            computeInstances: args.computeInstances,
            databaseInstances: args.databaseInstances,
            storageGB: args.storageGB,
            trafficRPS: args.trafficRPS,
            latencyRequirementMs: args.latencyRequirementMs,
            primaryRegion: args.primaryRegion,
            secondaryRegions: args.secondaryRegions ?? [],
            requiresMultiRegion: args.requiresMultiRegion ?? false,
            dataResidencyRequirements: []
          },
          optimizationWeights: {
            cost: args.costWeight,
            latency: args.latencyWeight,
            vendorLockIn: args.vendorLockInWeight
          }
        },
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "multicloud_job_status",
  "Poll the status of a multi-cloud exploration job. Status lifecycle: pending \u2192 running \u2192 completed | failed | cancelled. When completed, call multicloud_job_results. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Multi-cloud job ID returned by multicloud_explore")
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/multi-cloud/jobs/${args.jobId}`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "multicloud_job_results",
  "Retrieve the full results of a completed multi-cloud exploration job. Returns a ranked list of deployment strategies with per-provider cost, latency, and vendor lock-in scores, plus a comparison report summarizing trade-offs and the recommended strategy. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Multi-cloud job ID returned by multicloud_explore")
  },
  async (args) => {
    try {
      const result = await apiCall(
        "GET",
        `/api/multi-cloud/jobs/${args.jobId}/results`,
        void 0,
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "prediction_validate",
  "Submit an infrastructure validation job: test a simulation against a traffic forecast and detect SLA violations and bottlenecks. Returns a job ID immediately; poll prediction_job_status until completed, then call prediction_job_results to get bottleneck detections and recommended autoscaling thresholds. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the simulation to validate against the traffic forecast"),
    forecastName: z.string().describe("Human-readable name for this traffic forecast"),
    forecastDescription: z.string().optional().describe("Optional description of the forecast scenario"),
    dataPoints: z.array(
      z.object({
        timestamp: z.number().describe("Unix timestamp (seconds) for this data point"),
        rps: z.number().describe("Requests per second at this point in time"),
        label: z.string().optional().describe("Optional label such as 'morning peak' or 'flash sale'")
      })
    ).describe("Time-series traffic forecast data points"),
    peakRPS: z.number().optional().describe("Peak RPS across the forecast window (computed automatically if omitted)"),
    avgRPS: z.number().optional().describe("Average RPS across the forecast window (computed automatically if omitted)"),
    testSteps: z.number().int().min(1).default(100).describe("Number of simulation steps to run during validation (default 100)")
  },
  async (args) => {
    try {
      const trafficForecast = {
        name: args.forecastName,
        dataPoints: args.dataPoints
      };
      if (args.forecastDescription !== void 0) trafficForecast.description = args.forecastDescription;
      if (args.peakRPS !== void 0) trafficForecast.peakRPS = args.peakRPS;
      if (args.avgRPS !== void 0) trafficForecast.avgRPS = args.avgRPS;
      const result = await apiCall(
        "POST",
        "/api/predictions/validate",
        { simulationId: args.simulationId, trafficForecast, testSteps: args.testSteps },
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "prediction_job_status",
  "Poll the status of a prediction job (validation or threshold optimization). Status lifecycle: pending \u2192 running \u2192 completed | failed | cancelled. When status is 'completed', call prediction_job_results for the full report. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Prediction job ID returned by prediction_validate")
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/predictions/jobs/${args.jobId}`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "prediction_job_results",
  "Retrieve the full results of a completed prediction job. Includes: detected bottlenecks with severity and timing, SLA violation windows, per-resource health during the forecast, and recommended autoscaling thresholds. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Prediction job ID returned by prediction_validate")
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/predictions/jobs/${args.jobId}/results`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "optimization_run",
  "Start an infrastructure optimization analysis job. The engine generates architecture variants, runs batch simulations, and produces ranked recommendations to minimize cost, maximize performance, or balance both. Returns a job ID immediately; poll optimization_job_status until completed, then call optimization_job_results for recommendations. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the simulation to optimize"),
    primaryGoal: z.enum(["minimize_cost", "maximize_performance", "balance"]).describe("Primary optimization objective"),
    maxCostPerHour: z.number().min(0).optional().describe("Cost constraint: maximum acceptable cost in USD per simulated hour"),
    minThroughput: z.number().min(0).optional().describe("Performance constraint: minimum acceptable throughput in RPS"),
    maxLatencyP95: z.number().min(0).optional().describe("Performance constraint: maximum acceptable P95 latency in milliseconds"),
    costWeight: z.number().min(0).max(1).optional().describe("Weight for cost in multi-objective scoring (0\u20131)"),
    performanceWeight: z.number().min(0).max(1).optional().describe("Weight for performance in multi-objective scoring (0\u20131)"),
    stabilityWeight: z.number().min(0).max(1).optional().describe("Weight for stability in multi-objective scoring (0\u20131)"),
    trafficPattern: z.string().default("steady").describe("Traffic pattern to simulate during optimization: 'steady', 'ramp', 'burst', 'wave' (default 'steady')"),
    durationSteps: z.number().int().min(1).default(100).describe("Number of simulation steps for each variant evaluation (default 100)"),
    includeFailures: z.boolean().default(false).describe("Whether to include random failure injections during variant simulations (default false)")
  },
  async (args) => {
    try {
      const goals = { primary: args.primaryGoal };
      const constraints = {};
      if (args.maxCostPerHour !== void 0) constraints.max_cost_per_hour = args.maxCostPerHour;
      if (args.minThroughput !== void 0) constraints.min_throughput = args.minThroughput;
      if (args.maxLatencyP95 !== void 0) constraints.max_latency_p95 = args.maxLatencyP95;
      if (Object.keys(constraints).length > 0) goals.constraints = constraints;
      const weights = {};
      if (args.costWeight !== void 0) weights.cost = args.costWeight;
      if (args.performanceWeight !== void 0) weights.performance = args.performanceWeight;
      if (args.stabilityWeight !== void 0) weights.stability = args.stabilityWeight;
      if (Object.keys(weights).length > 0) goals.weights = weights;
      const result = await apiCall(
        "POST",
        "/api/analysis/optimize",
        {
          simulationId: args.simulationId,
          goals,
          testScenario: {
            traffic_pattern: args.trafficPattern,
            duration_steps: args.durationSteps,
            include_failures: args.includeFailures
          }
        },
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "optimization_job_status",
  "Poll the status of an infrastructure optimization job. Status lifecycle: pending \u2192 running \u2192 completed | failed | cancelled. Reports how many architecture variants have been generated and evaluated. When completed, call optimization_job_results for recommendations. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Optimization job ID returned by optimization_run")
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/analysis/jobs/${args.jobId}`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "optimization_job_results",
  "Retrieve the ranked infrastructure optimization recommendations for a completed job. Each recommendation includes a title, description, priority (critical/high/medium/low), the action to take, expected impact on cost/performance/reliability, and optionally suggested autoscaling configs or resource changes. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Optimization job ID returned by optimization_run")
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/analysis/jobs/${args.jobId}/recommendations`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "prediction_optimize_thresholds",
  "Submit a threshold optimization job: run a traffic forecast through the simulation engine and derive recommended CPU/latency scale-out and scale-in thresholds for each resource tier. Uses the same forecast format as prediction_validate. Returns a job ID immediately; poll prediction_job_status until completed, then call prediction_job_results to retrieve the recommended threshold table. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the simulation to derive thresholds for"),
    forecastName: z.string().describe("Human-readable name for this traffic forecast"),
    forecastDescription: z.string().optional().describe("Optional description of the forecast scenario"),
    dataPoints: z.array(
      z.object({
        timestamp: z.number().describe("Unix timestamp (seconds) for this data point"),
        rps: z.number().describe("Requests per second at this point in time"),
        label: z.string().optional().describe("Optional label such as 'morning peak' or 'flash sale'")
      })
    ).describe("Time-series traffic forecast data points"),
    peakRPS: z.number().optional().describe("Peak RPS across the forecast window (computed automatically if omitted)"),
    avgRPS: z.number().optional().describe("Average RPS across the forecast window (computed automatically if omitted)"),
    testSteps: z.number().int().min(1).default(100).describe("Number of simulation steps to run during threshold search (default 100)")
  },
  async (args) => {
    try {
      const trafficForecast = {
        name: args.forecastName,
        dataPoints: args.dataPoints
      };
      if (args.forecastDescription !== void 0) trafficForecast.description = args.forecastDescription;
      if (args.peakRPS !== void 0) trafficForecast.peakRPS = args.peakRPS;
      if (args.avgRPS !== void 0) trafficForecast.avgRPS = args.avgRPS;
      const result = await apiCall(
        "POST",
        "/api/predictions/optimize-thresholds",
        { simulationId: args.simulationId, trafficForecast, testSteps: args.testSteps },
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "inject_traffic",
  "Spike traffic into a running simulation. If a ramp pattern is active the call advances it by one increment; otherwise it injects a random traffic spike. Returns the updated simulation state and the event that was logged. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the simulation to inject traffic into")
  },
  async (args) => {
    try {
      const result = await apiCall("POST", `/api/simulations/${args.simulationId}/inject-traffic`, {}, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "inject_failure",
  "Randomly fail one healthy compute node in a running simulation. Returns the updated resource list and the failure event that was logged. Use get_simulation_events to review the full event log after injecting. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the simulation to inject a node failure into")
  },
  async (args) => {
    try {
      const result = await apiCall("POST", `/api/simulations/${args.simulationId}/inject-failure`, {}, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "get_simulation_events",
  "Retrieve the full ordered event log for a simulation. Events include scale-out/in actions, failure injections, cost spikes, bottleneck alerts, routing changes, and autoscaling triggers \u2014 the primary audit trail for understanding what happened during a run. Requires CWM_API_KEY with read scope.",
  {
    simulationId: z.string().describe("ID of the simulation whose event log to retrieve")
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/simulations/${args.simulationId}/events`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "delete_simulation",
  "Permanently delete a simulation and all of its associated metrics, events, snapshots, and failure injections. This action is irreversible. Requires CWM_API_KEY with write scope and ownership of the simulation.",
  {
    simulationId: z.string().describe("ID of the simulation to delete")
  },
  async (args) => {
    try {
      const result = await apiCall("DELETE", `/api/simulations/${args.simulationId}`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "create_snapshot",
  "Pin the current simulation state as a named snapshot for later comparison. Captures resources, latest metrics, active failures, and significant recent events. Returns a pinId you can use with get_snapshot to retrieve the pinned state later. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the simulation to snapshot"),
    label: z.string().optional().describe("Optional human-readable label for this snapshot (e.g. 'before scale-out')")
  },
  async (args) => {
    try {
      const body = {};
      if (args.label !== void 0) body.label = args.label;
      const result = await apiCall("POST", `/api/simulations/${args.simulationId}/snapshots`, body, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "list_snapshots",
  "List all pinned snapshots for a simulation in reverse chronological order (newest first). Returns summary entries with pinId, label, pinnedAt timestamp, and top-level metrics \u2014 use get_snapshot to retrieve full detail for a specific pin. Requires CWM_API_KEY with read scope.",
  {
    simulationId: z.string().describe("ID of the simulation whose snapshots to list")
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/simulations/${args.simulationId}/snapshots`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "get_snapshot",
  "Retrieve a specific pinned snapshot by its pin ID. Returns the full snapshot payload: resources at pin time, latest metrics, active failures, and the significant events that were captured. Useful for before/after comparisons after scaling or failure injection. Requires CWM_API_KEY with read scope.",
  {
    simulationId: z.string().describe("ID of the simulation that owns the snapshot"),
    pinId: z.string().describe("Pin ID returned by create_snapshot or list_snapshots")
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/simulations/${args.simulationId}/snapshots/${args.pinId}`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "ai_explain",
  "Generate a GPT-powered natural-language explanation of the simulation's current behavior: what is happening, why metrics look the way they do, and what the main drivers are. Set beginnerMode to true to receive simplified, jargon-free explanations. Requires CWM_API_KEY.",
  {
    simulationId: z.string().describe("ID of the simulation to explain"),
    beginnerMode: z.boolean().optional().describe("Set to true for simplified, beginner-friendly explanations (default false)")
  },
  async (args) => {
    try {
      const body = {};
      if (args.beginnerMode !== void 0) body.beginnerMode = args.beginnerMode;
      const result = await apiCall("POST", `/api/simulations/${args.simulationId}/explain`, body, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "ai_troubleshoot",
  "Generate AI-backed troubleshooting guidance for a specific problem in the simulation. Describe the issue and receive step-by-step diagnosis, root-cause hypotheses, and recommended remediation actions based on the current simulation state and event log. Requires CWM_API_KEY.",
  {
    simulationId: z.string().describe("ID of the simulation to troubleshoot"),
    issue: z.string().describe("Description of the problem to troubleshoot (e.g. 'latency spiking after 500 RPS', 'cost doubled after scale-out')"),
    beginnerMode: z.boolean().optional().describe("Set to true for simplified, beginner-friendly explanations (default false)")
  },
  async (args) => {
    try {
      const body = { issue: args.issue };
      if (args.beginnerMode !== void 0) body.beginnerMode = args.beginnerMode;
      const result = await apiCall("POST", `/api/simulations/${args.simulationId}/troubleshoot`, body, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "ai_analyze_bottlenecks",
  "Run AI-backed bottleneck detection on the simulation. Identifies the top resource constraints limiting throughput or causing latency/error spikes, ranks them by severity, and suggests targeted remediation (e.g. scale out a specific tier, add a cache layer, switch instance type). Requires CWM_API_KEY.",
  {
    simulationId: z.string().describe("ID of the simulation to analyze for bottlenecks"),
    beginnerMode: z.boolean().optional().describe("Set to true for simplified, beginner-friendly explanations (default false)")
  },
  async (args) => {
    try {
      const body = {};
      if (args.beginnerMode !== void 0) body.beginnerMode = args.beginnerMode;
      const result = await apiCall("POST", `/api/simulations/${args.simulationId}/analyze-bottlenecks`, body, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "rl_list_environments",
  "List all RL training environments owned by the API key. Returns environment IDs, linked simulation IDs, active/completed status, episode progress, cumulative reward, and idle-expiry timestamps. Use rl_create_environment to start a new one. Requires CWM_API_KEY with read scope.",
  {},
  async (_args) => {
    try {
      const result = await apiCall("GET", "/api/rl/environments", void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "rl_get_observation",
  "Manually poll the current observation vector for an RL environment without advancing the episode. Returns the obs struct (rps, cpu_util, instances, traffic, tick_seconds, warmup_factor) and metrics struct (cost_usd_hr, latency_p95, error_rate, uptime, sla_violations). Useful for inspecting state between rl_step calls. Requires CWM_API_KEY with read scope.",
  {
    environmentId: z.string().describe("RL environment ID returned by rl_create_environment")
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/rl/environments/${args.environmentId}/observation`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "rl_eval_episodes",
  "Run one or more deterministic evaluation episodes against an RL environment by replaying ordered action sequences. Each episode resets to the baseline state and then executes the provided actions in order, recording per-step rewards and a final cumulative score. Use this to benchmark a trained policy without modifying the live environment state. Returns a job ID immediately for async mode; poll rl_eval_episodes_status for the result. Requires CWM_API_KEY with write scope.",
  {
    environmentId: z.string().describe("RL environment ID to evaluate against"),
    episodes: z.array(
      z.array(
        z.object({
          actionType: z.enum(["scale_out", "scale_in", "add_resource", "remove_resource", "adjust_threshold", "set_recovery_policy"]).describe("Action to execute"),
          resourceId: z.string().optional().describe("Target resource ID"),
          instanceCount: z.number().int().optional().describe("Number of instances to add or remove"),
          cpuThreshold: z.number().optional().describe("New CPU scale-out threshold (for adjust_threshold)"),
          latencyThreshold: z.number().optional().describe("New latency threshold in ms (for adjust_threshold)")
        })
      )
    ).min(1).max(10).describe("Array of episodes; each episode is an ordered list of actions to replay"),
    collapseThreshold: z.number().min(0).max(1).optional().describe("Fraction drop in reward that triggers reward_collapse detection (default 0.20)")
  },
  async (args) => {
    try {
      const body = { actions: args.episodes };
      if (args.collapseThreshold !== void 0) body.collapseThreshold = args.collapseThreshold;
      const result = await apiCall(
        "POST",
        `/api/rl/environments/${args.environmentId}/eval-episodes`,
        body,
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "rl_eval_job_status",
  "Poll the status of an async RL evaluation job. Status lifecycle: pending \u2192 running \u2192 completed | failed. When completed, call rl_eval_job_results to retrieve the full per-episode scores. Requires CWM_API_KEY with read scope.",
  {
    environmentId: z.string().describe("RL environment ID the eval job belongs to"),
    jobId: z.string().describe("Eval job ID returned by rl_eval_episodes")
  },
  async (args) => {
    try {
      const result = await apiCall(
        "GET",
        `/api/rl/environments/${args.environmentId}/eval-episodes/${args.jobId}`,
        void 0,
        true
      );
      const r = result;
      return { content: [{ type: "text", text: JSON.stringify({ status: r.status, jobId: r.id, createdAt: r.createdAt, completedAt: r.completedAt, error: r.error }, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "rl_eval_job_results",
  "Retrieve the full results of a completed RL eval job. Returns per-episode cumulative rewards, per-step reward breakdowns, and reward_collapse flags. Call rl_eval_job_status first to confirm the job has completed. Requires CWM_API_KEY with read scope.",
  {
    environmentId: z.string().describe("RL environment ID the eval job belongs to"),
    jobId: z.string().describe("Eval job ID returned by rl_eval_episodes")
  },
  async (args) => {
    try {
      const result = await apiCall(
        "GET",
        `/api/rl/environments/${args.environmentId}/eval-episodes/${args.jobId}`,
        void 0,
        true
      );
      const r = result;
      if (r.status !== "completed") {
        return { content: [{ type: "text", text: `Job is not completed yet (status: ${r.status}). Poll rl_eval_job_status until completed before calling this tool.` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(r.result ?? result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "ai_optimize",
  "Generate AI-powered infrastructure optimization suggestions for a simulation. Returns a list of actionable recommendations ranked by expected impact \u2014 covering resource right-sizing, autoscaling tuning, caching, and multi-region strategies. Set beginnerMode for simplified explanations. Requires CWM_API_KEY.",
  {
    simulationId: z.string().describe("ID of the simulation to optimize"),
    beginnerMode: z.boolean().optional().describe("Set to true for simplified, beginner-friendly suggestions (default false)")
  },
  async (args) => {
    try {
      const body = {};
      if (args.beginnerMode !== void 0) body.beginnerMode = args.beginnerMode;
      const result = await apiCall("POST", `/api/simulations/${args.simulationId}/optimize`, body, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "create_traffic",
  "Create a persistent traffic pattern for a simulation (ramp, burst, step, wave, or spike). Unlike inject_traffic, this creates a named, manageable pattern that persists across steps and can be updated or deleted via update_traffic/delete_traffic. Returns the created pattern with its patternId. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the simulation to add the pattern to"),
    type: z.enum(["ramp", "burst", "step", "wave", "custom"]).describe("Traffic pattern type"),
    name: z.string().optional().describe("Human-readable name for the pattern (required by the API; defaults to '<type>-<timestamp>' if omitted)"),
    startTime: z.number().optional().describe("Simulation step at which the pattern begins (default 0)"),
    rpsTarget: z.number().min(0).optional().describe("Target RPS for the pattern (depends on type)"),
    durationSteps: z.number().int().min(1).optional().describe("Number of simulation steps for this pattern to run"),
    parameters: z.record(z.unknown()).optional().describe("Additional pattern-specific parameters (e.g. { rampRate: 100, peakRPS: 5000 })")
  },
  async (args) => {
    try {
      const body = {
        type: args.type,
        name: args.name ?? `${args.type}-${Date.now()}`,
        startTime: args.startTime ?? 0
      };
      if (args.rpsTarget !== void 0) body.rpsTarget = args.rpsTarget;
      if (args.durationSteps !== void 0) body.durationSteps = args.durationSteps;
      if (args.parameters !== void 0) body.parameters = args.parameters;
      const result = await apiCall("POST", `/api/simulations/${args.simulationId}/patterns`, body, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "update_traffic",
  "Update an existing traffic pattern by its patternId. Supports partial updates \u2014 only the fields you provide are changed. Requires CWM_API_KEY with write scope.",
  {
    patternId: z.string().describe("Pattern ID returned by create_traffic"),
    rpsTarget: z.number().min(0).optional().describe("New target RPS"),
    durationSteps: z.number().int().min(1).optional().describe("New step duration"),
    parameters: z.record(z.unknown()).optional().describe("Pattern-specific parameters to merge/update"),
    isActive: z.boolean().optional().describe("Set to false to deactivate the pattern without deleting it")
  },
  async (args) => {
    try {
      const body = {};
      if (args.rpsTarget !== void 0) body.rpsTarget = args.rpsTarget;
      if (args.durationSteps !== void 0) body.durationSteps = args.durationSteps;
      if (args.parameters !== void 0) body.parameters = args.parameters;
      if (args.isActive !== void 0) body.isActive = args.isActive;
      const result = await apiCall("PATCH", `/api/patterns/${args.patternId}`, body, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "delete_traffic",
  "Delete a traffic pattern by its patternId. The pattern is removed permanently from the simulation. Requires CWM_API_KEY with write scope.",
  {
    patternId: z.string().describe("Pattern ID returned by create_traffic")
  },
  async (args) => {
    try {
      await apiCall("DELETE", `/api/patterns/${args.patternId}`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify({ deleted: true, patternId: args.patternId }) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "create_failure",
  "Inject a persistent, typed failure into a simulation via the lifecycle API. Supports instance_kill, az_outage, database_overload, and network_latency failures. Returns the created failure record with its failureId for later update/delete. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the simulation to inject the failure into"),
    type: z.enum(["instance_kill", "az_outage", "database_overload", "network_latency"]).describe("Type of failure to inject"),
    name: z.string().optional().describe("Human-readable label for this failure injection (required by the API; defaults to '<type>-<timestamp>' if omitted)"),
    startTime: z.number().optional().describe("Simulation step at which the failure begins (default 0)"),
    targetResourceId: z.string().optional().describe("ID of the specific resource to target (required for instance_kill; optional for others)"),
    parameters: z.record(z.unknown()).optional().describe("Type-specific parameters (e.g. { azId: 'us-east-1a' } for az_outage, { latencyMs: 200 } for network_latency)"),
    isActive: z.boolean().optional().describe("Whether the failure should be active immediately (default true)")
  },
  async (args) => {
    try {
      const body = {
        type: args.type,
        name: args.name ?? `${args.type}-${Date.now()}`,
        startTime: args.startTime ?? 0
      };
      if (args.targetResourceId !== void 0) body.targetResourceId = args.targetResourceId;
      if (args.parameters !== void 0) body.parameters = args.parameters;
      if (args.isActive !== void 0) body.isActive = args.isActive;
      const result = await apiCall("POST", `/api/simulations/${args.simulationId}/failures`, body, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "update_failure",
  "Update an existing failure injection by its failureId. Use isActive: false to deactivate/resolve the failure without deleting it. Requires CWM_API_KEY with write scope.",
  {
    failureId: z.string().describe("Failure ID returned by create_failure"),
    isActive: z.boolean().optional().describe("Set to false to resolve/deactivate the failure"),
    parameters: z.record(z.unknown()).optional().describe("Updated failure parameters to merge")
  },
  async (args) => {
    try {
      const body = {};
      if (args.isActive !== void 0) body.isActive = args.isActive;
      if (args.parameters !== void 0) body.parameters = args.parameters;
      const result = await apiCall("PATCH", `/api/failures/${args.failureId}`, body, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "delete_failure",
  "Permanently delete a failure injection by its failureId. The failure is removed and its effects are cleared from the simulation. Requires CWM_API_KEY with write scope.",
  {
    failureId: z.string().describe("Failure ID returned by create_failure")
  },
  async (args) => {
    try {
      await apiCall("DELETE", `/api/failures/${args.failureId}`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify({ deleted: true, failureId: args.failureId }) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "bulk_resize",
  "Resize all compute resources in a DigitalOcean simulation to a new droplet size in one call. Applies the new size tier (hourly rate, throughput cap) to every compute node simultaneously. Use list_simulations to find the simulationId. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the DigitalOcean simulation to resize"),
    dropletSize: z.string().describe("Target droplet size label (e.g. 's-1vcpu-1gb', 's-2vcpu-4gb', 's-4vcpu-8gb', 's-8vcpu-16gb', 'c-4'). Must be a valid DigitalOcean droplet size supported by the platform.")
  },
  async (args) => {
    try {
      const result = await apiCall("POST", `/api/simulations/${args.simulationId}/bulk-resize`, { dropletSize: args.dropletSize }, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "simulation_claim",
  "Claim ownership of a simulation using the current API key. Useful when a simulation was created anonymously (via the UI) and you want to associate it with your API key for persistent access and multi-step automation. Returns the updated simulation. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the unclaimed simulation to claim")
  },
  async (args) => {
    try {
      const result = await apiCall("POST", `/api/simulations/${args.simulationId}/claim`, {}, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "validate_accuracy",
  "Validate the cost and performance accuracy of a simulation against real-world provider reference data. Returns cost accuracy (\xB110% threshold) and performance accuracy (\xB115% threshold) scores, plus an overallValid flag. Use this to verify your simulation is within acceptable drift before using its output for production decisions. Requires CWM_API_KEY.",
  {
    simulationId: z.string().describe("ID of the simulation to validate")
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/simulations/${args.simulationId}/validate-accuracy`, void 0, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
server.tool(
  "list_benchmarks",
  "List accuracy benchmark results for all supported AWS 6th-generation instance types (m6i, c6i, r6i families). Returns per-instance overall score, cost score, latency score, and performance score \u2014 useful for comparing which instance tier simulates most accurately for your workload. No authentication required.",
  {},
  async (_args) => {
    try {
      const result = await apiCall("GET", "/api/accuracy-benchmark/instances");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Cloud World Model MCP server running on stdio");
}
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
