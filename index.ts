import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.CWM_BASE_URL ?? "http://localhost:5000";
const API_KEY = process.env.CWM_API_KEY ?? "";

async function apiCall(
  method: string,
  path: string,
  body?: unknown,
  requireAuth = false
): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (requireAuth) {
    if (!API_KEY) {
      throw new Error(
        "CWM_API_KEY environment variable is required for this tool. " +
          "Set it to a valid API key obtained from POST /api/keys on your Cloud World Model instance."
      );
    }
    headers["Authorization"] = `Bearer ${API_KEY}`;
  } else if (API_KEY) {
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const errMsg =
      typeof data === "object" && data !== null && "error" in data
        ? (data as Record<string, unknown>).error
        : text;
    throw new Error(`API error ${res.status}: ${errMsg}`);
  }

  return data;
}

const server = new McpServer({
  name: "cloud-world-model",
  version: "1.0.0",
});

server.tool(
  "create_simulation",
  "Create a new virtual cloud environment (simulation) with resources such as compute, database, storage, network, cache, queue, or kubernetes nodes. Returns the created simulation object including its id, which is required for subsequent calls. Requires CWM_API_KEY with write scope.",
  {
    name: z.string().describe("Human-readable name for the simulation"),
    description: z.string().optional().describe("Optional description of the simulation scenario"),
    resources: z
      .array(
        z.object({
          id: z.string().describe("Unique identifier for this resource within the simulation"),
          type: z
            .enum(["compute", "database", "storage", "network", "cache", "queue", "kubernetes"])
            .describe("Resource category"),
          name: z.string().describe("Display name for the resource"),
          provider: z
            .enum(["aws", "gcp", "azure", "oci", "digitalocean"])
            .default("aws")
            .describe("Cloud provider"),
          characteristics: z
            .object({
              size: z.string().optional().describe("Instance/resource size, e.g. t3.medium, n1-standard-2"),
              maxThroughput: z.number().optional().describe("Max requests per second"),
              maxConnections: z.number().optional().describe("Max concurrent connections"),
              autoscaling: z.boolean().optional().describe("Whether autoscaling is enabled"),
            })
            .optional()
            .describe("Provider-specific resource characteristics"),
        })
      )
      .describe("List of cloud resources composing this simulation"),
    connections: z
      .array(
        z.object({
          sourceId: z.string(),
          targetId: z.string(),
          label: z.string().optional(),
        })
      )
      .optional()
      .describe("Directed connections between resources (e.g. web server → database)"),
    traffic: z.number().default(0).describe("Initial traffic level in requests per second (0–100 scale)"),
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
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "simulate_step",
  "Advance a simulation by one time step and return updated metrics (CPU, latency, throughput, error rate, cost). Use this to drive the simulation forward and observe system behaviour over time. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the simulation to step (from create_simulation)"),
    traffic: z
      .number()
      .min(0)
      .optional()
      .describe("Optional traffic override in RPS for this step. Omit to use the simulation's current traffic."),
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = {};
      if (args.traffic !== undefined) body.traffic = args.traffic;
      const result = await apiCall("POST", `/api/simulations/${args.simulationId}/step`, body, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "get_simulation_metrics",
  "Read the latest metrics and resource states for an existing simulation. Returns latency (P50/P95/P99), CPU usage, memory, throughput, error rate, cost per hour, and per-resource health. Requires CWM_API_KEY with read scope.",
  {
    simulationId: z.string().describe("ID of the simulation to query"),
  },
  async (args) => {
    try {
      const [simulation, metrics] = await Promise.all([
        apiCall("GET", `/api/simulations/${args.simulationId}`, undefined, true),
        apiCall("GET", `/api/simulations/${args.simulationId}/metrics`, undefined, true),
      ]);
      return {
        content: [{ type: "text", text: JSON.stringify({ simulation, metrics }, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "list_simulations",
  "List all simulations owned by the current API key. Returns simulation IDs, names, resource counts, and status. Use the returned IDs with simulate_step, get_simulation_metrics, rl_create_environment, chaos_run, or multicloud_explore. Requires CWM_API_KEY with read scope.",
  {},
  async () => {
    try {
      const result = await apiCall("GET", "/api/simulations", undefined, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "rl_create_environment",
  "Create a Gym-compatible reinforcement learning training environment linked to a simulation. Returns an initial observation vector and an environment id for use with rl_step. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z
      .string()
      .describe("ID of the simulation to wrap as an RL environment"),
    maxSteps: z
      .number()
      .int()
      .min(1)
      .max(10000)
      .default(300)
      .describe("Maximum number of steps per episode (1–10000, default 300)"),
    initialTraffic: z
      .number()
      .min(0)
      .default(10000)
      .describe("Initial traffic load at the start of each episode in RPS (default 10000)"),
    targetTrafficPattern: z
      .enum(["ramp", "burst", "step", "wave", "custom"])
      .optional()
      .describe("Traffic pattern to apply during training episodes"),
    maxLatencyP95Ms: z
      .number()
      .min(0)
      .default(200)
      .describe("SLA target: maximum P95 latency in milliseconds (default 200)"),
    maxErrorRatePercent: z
      .number()
      .min(0)
      .max(100)
      .default(1)
      .describe("SLA target: maximum acceptable error rate in percent (default 1)"),
    costBudgetPerHour: z
      .number()
      .min(0)
      .optional()
      .describe("Optional cost budget in USD per simulated hour. Episodes that exceed this budget incur negative reward."),
    enableFailures: z
      .boolean()
      .default(false)
      .describe("Whether to randomly inject failures during training episodes (default false)"),
  },
  async (args) => {
    try {
      const episodeConfig: Record<string, unknown> = {
        maxSteps: args.maxSteps,
        initialTraffic: args.initialTraffic,
        targetSLA: {
          maxLatencyP95: args.maxLatencyP95Ms,
          maxErrorRate: args.maxErrorRatePercent,
        },
        enableFailures: args.enableFailures,
      };
      if (args.targetTrafficPattern) episodeConfig.targetTrafficPattern = args.targetTrafficPattern;
      if (args.costBudgetPerHour !== undefined) episodeConfig.costBudgetPerHour = args.costBudgetPerHour;

      const result = await apiCall(
        "POST",
        "/api/rl/environments",
        { simulationId: args.simulationId, episodeConfig },
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "rl_step",
  "Execute one RL action in a training environment and receive the next observation, reward, done flag, and diagnostic info. When done=true, call rl_reset to start a new episode. Requires CWM_API_KEY with write scope.\n\nAction types:\n- scale_out: add compute instances\n- scale_in: remove compute instances\n- add_resource: add a new resource node\n- remove_resource: remove a resource node\n- adjust_threshold: change autoscaling CPU/latency/throughput thresholds\n- set_recovery_policy: set per-resource recovery thresholds (requires resourceId + criticalCpuThreshold/criticalSteps/warningCpuThreshold/warningSteps)",
  {
    environmentId: z
      .string()
      .describe("ID of the RL environment (from rl_create_environment)"),
    actionType: z
      .enum(["adjust_threshold", "scale_out", "scale_in", "add_resource", "remove_resource", "set_recovery_policy"])
      .describe("Type of autoscaling action to apply"),
    resourceId: z
      .string()
      .optional()
      .describe("ID of the specific resource to target. Required for add_resource, remove_resource, and set_recovery_policy."),
    instanceCount: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Number of instances to add or remove (for scale_out / scale_in)"),
    cpuThreshold: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("New CPU scale-out threshold in percent (for adjust_threshold)"),
    latencyThreshold: z
      .number()
      .min(0)
      .optional()
      .describe("New latency threshold in milliseconds (for adjust_threshold)"),
    resourceType: z
      .enum(["compute", "database", "storage", "network"])
      .optional()
      .describe("Type of resource to add (for add_resource)"),
    provider: z
      .enum(["aws", "gcp", "azure", "oci", "digitalocean"])
      .optional()
      .describe("Cloud provider for the new resource (for add_resource)"),
    criticalCpuThreshold: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("CPU % above which a resource is considered critical (for set_recovery_policy). Default 80."),
    criticalSteps: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Steps the resource must stay at critical CPU before recovery triggers (for set_recovery_policy). Default 4."),
    warningCpuThreshold: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("CPU % above which a resource is considered in warning state (for set_recovery_policy). Default 70."),
    warningSteps: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Steps the resource must stay at warning CPU before recovery triggers (for set_recovery_policy). Default 3."),
  },
  async (args) => {
    try {
      const parameters: Record<string, unknown> = {};
      if (args.resourceId !== undefined) parameters.resourceId = args.resourceId;
      if (args.instanceCount !== undefined) parameters.instanceCount = args.instanceCount;
      if (args.cpuThreshold !== undefined) parameters.cpuThreshold = args.cpuThreshold;
      if (args.latencyThreshold !== undefined) parameters.latencyThreshold = args.latencyThreshold;
      if (args.resourceType !== undefined) parameters.resourceType = args.resourceType;
      if (args.provider !== undefined) parameters.provider = args.provider;
      if (
        args.criticalCpuThreshold !== undefined ||
        args.criticalSteps !== undefined ||
        args.warningCpuThreshold !== undefined ||
        args.warningSteps !== undefined
      ) {
        parameters.recoveryPolicy = {
          criticalCpuThreshold: args.criticalCpuThreshold ?? 80,
          criticalSteps: args.criticalSteps ?? 4,
          warningCpuThreshold: args.warningCpuThreshold ?? 70,
          warningSteps: args.warningSteps ?? 3,
        };
      }

      const result = await apiCall(
        "POST",
        `/api/rl/environments/${args.environmentId}/step`,
        { action: { type: args.actionType, parameters } },
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "rl_reset",
  "Reset an RL environment to begin a fresh training episode. Returns the initial observation for the new episode. Call this when the done flag from rl_step is true. Requires CWM_API_KEY with write scope.",
  {
    environmentId: z.string().describe("ID of the RL environment to reset"),
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
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
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
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "chaos_run",
  "Inject a failure into a simulation and measure resilience. Returns a job ID immediately; poll chaos_job_status until completed, then retrieve the full report with chaos_job_results. Either scenarioId or customInjections must be provided. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the simulation to run chaos against"),
    scenarioId: z
      .string()
      .optional()
      .describe(
        "Pre-built chaos scenario ID (e.g. az_outage, db_crash, network_partition, cascading_failure, cpu_stress). " +
          "Use list_chaos_scenarios to browse available IDs."
      ),
    customInjections: z
      .array(
        z.object({
          failureType: z
            .enum([
              "database_crash",
              "database_slowdown",
              "zone_outage",
              "instance_failure",
              "network_latency",
              "network_partition",
              "cascading_failure",
              "cpu_stress",
            ])
            .describe("Type of failure to inject"),
          targetResourceId: z.string().optional().describe("Specific resource to target"),
          targetZone: z.string().optional().describe("Availability zone to target"),
          intensity: z
            .number()
            .min(0)
            .max(100)
            .optional()
            .describe("Failure severity from 0 (minimal) to 100 (maximum)"),
          duration: z.number().optional().describe("Duration of the failure in simulation seconds"),
        })
      )
      .optional()
      .describe("Custom failure injections — use instead of scenarioId for fine-grained control."),
    duration: z
      .number()
      .min(10)
      .max(1000)
      .default(300)
      .describe("Total chaos experiment duration in simulation seconds (10–1000, default 300)"),
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = {
        simulationId: args.simulationId,
        duration: args.duration,
      };
      if (args.scenarioId) body.scenarioId = args.scenarioId;
      if (args.customInjections) body.customInjections = args.customInjections;

      const result = await apiCall("POST", "/api/chaos/run", body, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "chaos_job_status",
  "Poll the status of a chaos job. Status lifecycle: pending → running → completed | failed | cancelled. When status is 'completed', call chaos_job_results for the full resilience report. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Chaos job ID returned by chaos_run"),
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/chaos/jobs/${args.jobId}`, undefined, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "chaos_job_results",
  "Retrieve the full resilience report for a completed chaos job. Includes: overall resilience score (0–100), letter grade (A–F), score breakdown by recovery/availability/data-integrity/graceful-degradation, discovered vulnerabilities with severity and remediation advice, and a timeline of events. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Chaos job ID returned by chaos_run"),
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/chaos/jobs/${args.jobId}/results`, undefined, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
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
    latencyRequirementMs: z
      .number()
      .min(1)
      .describe("Maximum acceptable P95 latency in milliseconds (your SLA)"),
    primaryRegion: z
      .string()
      .describe(
        "Primary deployment region, e.g. 'us-east-1', 'us-central1', 'eastus'. " +
          "This is the main region where most traffic originates."
      ),
    secondaryRegions: z
      .array(z.string())
      .optional()
      .describe("Optional list of secondary/failover regions"),
    requiresMultiRegion: z
      .boolean()
      .optional()
      .describe("Whether the architecture must span multiple regions (default false)"),
    costWeight: z
      .number()
      .min(0)
      .max(1)
      .default(0.4)
      .describe("Optimization weight for minimizing cost (0–1, default 0.4)"),
    latencyWeight: z
      .number()
      .min(0)
      .max(1)
      .default(0.4)
      .describe("Optimization weight for minimizing latency (0–1, default 0.4)"),
    vendorLockInWeight: z
      .number()
      .min(0)
      .max(1)
      .default(0.2)
      .describe("Optimization weight for minimizing vendor lock-in risk (0–1, default 0.2)"),
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
            dataResidencyRequirements: [],
          },
          optimizationWeights: {
            cost: args.costWeight,
            latency: args.latencyWeight,
            vendorLockIn: args.vendorLockInWeight,
          },
        },
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "multicloud_job_status",
  "Poll the status of a multi-cloud exploration job. Status lifecycle: pending → running → completed | failed | cancelled. When completed, call multicloud_job_results. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Multi-cloud job ID returned by multicloud_explore"),
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/multi-cloud/jobs/${args.jobId}`, undefined, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "multicloud_job_results",
  "Retrieve the full results of a completed multi-cloud exploration job. Returns a ranked list of deployment strategies with per-provider cost, latency, and vendor lock-in scores, plus a comparison report summarizing trade-offs and the recommended strategy. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Multi-cloud job ID returned by multicloud_explore"),
  },
  async (args) => {
    try {
      const result = await apiCall(
        "GET",
        `/api/multi-cloud/jobs/${args.jobId}/results`,
        undefined,
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
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
    dataPoints: z
      .array(
        z.object({
          timestamp: z.number().describe("Unix timestamp (seconds) for this data point"),
          rps: z.number().describe("Requests per second at this point in time"),
          label: z.string().optional().describe("Optional label such as 'morning peak' or 'flash sale'"),
        })
      )
      .describe("Time-series traffic forecast data points"),
    peakRPS: z.number().optional().describe("Peak RPS across the forecast window (computed automatically if omitted)"),
    avgRPS: z.number().optional().describe("Average RPS across the forecast window (computed automatically if omitted)"),
    testSteps: z
      .number()
      .int()
      .min(1)
      .default(100)
      .describe("Number of simulation steps to run during validation (default 100)"),
  },
  async (args) => {
    try {
      const trafficForecast: Record<string, unknown> = {
        name: args.forecastName,
        dataPoints: args.dataPoints,
      };
      if (args.forecastDescription !== undefined) trafficForecast.description = args.forecastDescription;
      if (args.peakRPS !== undefined) trafficForecast.peakRPS = args.peakRPS;
      if (args.avgRPS !== undefined) trafficForecast.avgRPS = args.avgRPS;

      const result = await apiCall(
        "POST",
        "/api/predictions/validate",
        { simulationId: args.simulationId, trafficForecast, testSteps: args.testSteps },
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "prediction_job_status",
  "Poll the status of a prediction job (validation or threshold optimization). Status lifecycle: pending → running → completed | failed | cancelled. When status is 'completed', call prediction_job_results for the full report. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Prediction job ID returned by prediction_validate"),
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/predictions/jobs/${args.jobId}`, undefined, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "prediction_job_results",
  "Retrieve the full results of a completed prediction job. Includes: detected bottlenecks with severity and timing, SLA violation windows, per-resource health during the forecast, and recommended autoscaling thresholds. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Prediction job ID returned by prediction_validate"),
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/predictions/jobs/${args.jobId}/results`, undefined, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "optimization_run",
  "Start an infrastructure optimization analysis job. The engine generates architecture variants, runs batch simulations, and produces ranked recommendations to minimize cost, maximize performance, or balance both. Returns a job ID immediately; poll optimization_job_status until completed, then call optimization_job_results for recommendations. Requires CWM_API_KEY with write scope.",
  {
    simulationId: z.string().describe("ID of the simulation to optimize"),
    primaryGoal: z
      .enum(["minimize_cost", "maximize_performance", "balance"])
      .describe("Primary optimization objective"),
    maxCostPerHour: z
      .number()
      .min(0)
      .optional()
      .describe("Cost constraint: maximum acceptable cost in USD per simulated hour"),
    minThroughput: z
      .number()
      .min(0)
      .optional()
      .describe("Performance constraint: minimum acceptable throughput in RPS"),
    maxLatencyP95: z
      .number()
      .min(0)
      .optional()
      .describe("Performance constraint: maximum acceptable P95 latency in milliseconds"),
    costWeight: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Weight for cost in multi-objective scoring (0–1)"),
    performanceWeight: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Weight for performance in multi-objective scoring (0–1)"),
    stabilityWeight: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Weight for stability in multi-objective scoring (0–1)"),
    trafficPattern: z
      .string()
      .default("steady")
      .describe("Traffic pattern to simulate during optimization: 'steady', 'ramp', 'burst', 'wave' (default 'steady')"),
    durationSteps: z
      .number()
      .int()
      .min(1)
      .default(100)
      .describe("Number of simulation steps for each variant evaluation (default 100)"),
    includeFailures: z
      .boolean()
      .default(false)
      .describe("Whether to include random failure injections during variant simulations (default false)"),
  },
  async (args) => {
    try {
      const goals: Record<string, unknown> = { primary: args.primaryGoal };

      const constraints: Record<string, unknown> = {};
      if (args.maxCostPerHour !== undefined) constraints.max_cost_per_hour = args.maxCostPerHour;
      if (args.minThroughput !== undefined) constraints.min_throughput = args.minThroughput;
      if (args.maxLatencyP95 !== undefined) constraints.max_latency_p95 = args.maxLatencyP95;
      if (Object.keys(constraints).length > 0) goals.constraints = constraints;

      const weights: Record<string, unknown> = {};
      if (args.costWeight !== undefined) weights.cost = args.costWeight;
      if (args.performanceWeight !== undefined) weights.performance = args.performanceWeight;
      if (args.stabilityWeight !== undefined) weights.stability = args.stabilityWeight;
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
            include_failures: args.includeFailures,
          },
        },
        true
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "optimization_job_status",
  "Poll the status of an infrastructure optimization job. Status lifecycle: pending → running → completed | failed | cancelled. Reports how many architecture variants have been generated and evaluated. When completed, call optimization_job_results for recommendations. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Optimization job ID returned by optimization_run"),
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/analysis/jobs/${args.jobId}`, undefined, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "optimization_job_results",
  "Retrieve the ranked infrastructure optimization recommendations for a completed job. Each recommendation includes a title, description, priority (critical/high/medium/low), the action to take, expected impact on cost/performance/reliability, and optionally suggested autoscaling configs or resource changes. Requires CWM_API_KEY with read scope.",
  {
    jobId: z.string().describe("Optimization job ID returned by optimization_run"),
  },
  async (args) => {
    try {
      const result = await apiCall("GET", `/api/analysis/jobs/${args.jobId}/recommendations`, undefined, true);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
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
