import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RATE_PROVENANCE_RESOLUTIONS } from "../shared/provider-pricing";
import { sessionAffinitySchema } from "../shared/session-affinity";
import { cdnTrafficSchema } from "../shared/cdn-traffic";
import { completedResilienceEvidenceSchema, preProvisionFinalizeRequestSchema } from "../shared/pre-provision-evidence";
import {
  externalMetricsConfigSchema,
  externalMetricsTelemetrySchema,
} from "../shared/external-metrics";
import {
  goodputWindowFromPersistedMetrics,
} from "../shared/goodput-comparison";
import {
  goodputIntervalAttributionSchema,
  goodputWindowSchema,
  predictionLatencyAvailabilitySchema,
  storedPredictionEvidenceSchema,
  providerApiLimitSimulationRequestSchema,
  scenarioDefaultFailureInjectionSchema,
  scenarioFailurePhaseSummarySchema,
  scenarioRetryTrafficDisclosureSchema,
  scenarioTrafficPhaseSummarySchema,
  kubernetesCpuHpaSchema,
  kubernetesCpuHpaTelemetrySchema,
  type Scenario,
} from "../shared/schema";
import type { CpuHpaAudit } from "../shared/mcp-contract";

export type ApiCall = (
  method: string,
  path: string,
  body?: unknown,
  requireAuth?: boolean
) => Promise<unknown>;

export interface ToolContext {
  apiCall: ApiCall;
  baseUrl: string;
  /**
   * Public base URL used when a tool needs to hand the caller a URL they can
   * reach (e.g. the OpenAPI spec). Defaults to baseUrl. The HTTP transport
   * sets this to the request's public origin because its baseUrl is a
   * loopback self-fetch address.
   */
  specBaseUrl?: string;
}

// The intentionally narrow tools available to anonymous (demo) Streamable HTTP sessions.
// Their demo-mode implementations are registered by registerDemoTools()
// below (same file, shared helpers) so the two transports cannot drift.
// Sequence reflects the intended demo workflow:
//   list → get scenario → create → inject → fail → recover → step → metrics → delete
export const DEMO_TOOL_NAMES = [
  "scenario.list",
  "scenario.get",
  "simulation.create",
  "simulation.inject_traffic",
  "simulation.inject_failure",
  "simulation.recover_resource",
  "simulation.step",
  "simulation.metrics",
  "simulation.delete",
] as const;

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true as const };
}

function limitResult(code: string, message: string) {
  const body = {
    status: "limit_reached" as const,
    code,
    message,
    retryable: false,
    requiresAuthentication: true,
    nextAction: "Reconnect with a Cloud World Model API key for unlimited access.",
  };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }],
    structuredContent: body as Record<string, unknown>,
  };
}

function accessDeniedResult(code: string, message: string) {
  const body = {
    status: "access_denied" as const,
    code,
    message,
    retryable: false,
  };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }],
    structuredContent: body as Record<string, unknown>,
  };
}

function notReadyResult(code: string, message: string, pollWith: string) {
  const body = {
    status: "not_ready" as const,
    code,
    message,
    retryable: true,
    pollWith,
  };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }],
    structuredContent: body as Record<string, unknown>,
  };
}

function noActiveSimResult() {
  const body = {
    status: "no_active_simulation" as const,
    code: "NO_ACTIVE_SIMULATION",
    message:
      "No simulationId was provided and this session has no current simulation (none created yet, or it was deleted/expired).",
    retryable: false,
    nextAction:
      "Call simulation.create first, then retry — either omit simulationId to use the new simulation or pass its id explicitly.",
  };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }],
    structuredContent: body as Record<string, unknown>,
  };
}

/**
 * Compact step-response shaper. The full backend step response includes the
 * entire simulation object (all resource characteristics, connections,
 * topology metadata, seeds, timestamps, cost breakdowns) — 3–5k tokens that
 * compound into every subsequent LLM prompt. In compact mode (the default)
 * we return only what an agent needs to drive the loop: traffic level,
 * principal latency/error/cost metrics, per-resource CPU + routedRps +
 * availability/routability status, and this step's events.
 */
export function toCompactStepResponse(raw: unknown): Record<string, unknown> {
  const obj = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const simulation =
    obj.simulation !== null && typeof obj.simulation === "object"
      ? (obj.simulation as Record<string, unknown>)
      : {};
  const metrics =
    obj.metrics !== null && typeof obj.metrics === "object"
      ? (obj.metrics as Record<string, unknown>)
      : {};
  const rawResources = Array.isArray(simulation.resources) ? simulation.resources : [];
  const rawEvents = Array.isArray(obj.events) ? obj.events : [];
  const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
  const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
  const latencyUnavailable = (value: Record<string, unknown>) => {
    const evidence = value.predictionEvidence;
    return evidence !== null && typeof evidence === "object" &&
      (evidence as Record<string, unknown>).latencyAvailability !== null &&
      typeof (evidence as Record<string, unknown>).latencyAvailability === "object" &&
      ((evidence as Record<string, unknown>).latencyAvailability as Record<string, unknown>).status === "unavailable";
  };
  const latencyValue = (field: string) => latencyUnavailable(metrics) ? null : num(metrics[field]);

  const compact: Record<string, unknown> = {
    simulationId: str(simulation.id),
    scenarioHash: str(obj.scenarioHash ?? simulation.scenarioHash),
    effectiveConfigHash: str(obj.effectiveConfigHash ?? simulation.effectiveConfigHash),
    predictionEffectiveConfigHash: str(obj.predictionEffectiveConfigHash ?? simulation.predictionEffectiveConfigHash),
    engineVersion: str(obj.engineVersion ?? simulation.engineVersion),
    calibrationEvidence: metrics.calibrationEvidence ?? obj.calibrationEvidence ?? simulation.calibrationEvidence,
    predictionEvidence: metrics.predictionEvidence ?? obj.predictionEvidence ?? simulation.predictionEvidence,
    appWeight: simulation.appWeight ?? obj.appWeight,
    appWeightDefaulted: simulation.appWeightDefaulted ?? obj.appWeightDefaulted,
    predictionEvidenceStatus: metrics.predictionEvidenceStatus ?? obj.predictionEvidenceStatus,
    replayIdentity: obj.replayIdentity ?? simulation.replayIdentity,
    currentStep: num(simulation.currentTime),
    traffic: num(simulation.traffic),
    latencyAvailability: metrics.latencyAvailability ?? (metrics.predictionEvidence as Record<string, unknown> | undefined)?.latencyAvailability,
    latencyP50: latencyValue("latencyP50"),
    latencyP95: latencyValue("latencyP95"),
    latencyP99: latencyValue("latencyP99"),
    latencyP99Basis: str(metrics.latencyP99Basis),
    errorRate: num(metrics.errorRate),
    throughput: num(metrics.throughput),
    goodputRps: num(metrics.throughput),
    goodputSemantics: "post_step_point_rate",
    goodputProvenance: {
      kind: "derived",
      sourceFields: ["metrics.throughput"],
    },
    goodputWindow: goodputWindowFromPersistedMetrics(
      str(simulation.id) ?? "",
      [metrics],
    ),
    offeredRps: num(metrics.offeredRps),
    modeledShedRps: num(metrics.modeledShedRps),
    costPerHour: num(metrics.costPerHour),
    residualCostPerHour: num(metrics.residualCostPerHour),
    residualCostDefinition: str(metrics.residualCostDefinition),
    ...(Array.isArray(metrics.requestServing) ? { requestServing: metrics.requestServing } : {}),
    latencyBasis: str(metrics.latencyBasis),
    metricId: str(metrics.metricId),
    resources: toCompactResources(rawResources, rawEvents),
    events: rawEvents.map(toMcpEvent),
    // EKS Spot migration evidence is deliberately kept beside compact
    // resource status. Agents must be able to distinguish a missed 120s
    // migration deadline from later service recovery without requesting full
    // simulation state.
    // A response currentTime identifies simulation state, not a persisted
    // metric row. Do not turn it into a fabricated history index.
    ...compactEksEvidence(metrics),
    ...(metrics.sessionAffinity !== undefined ? { sessionAffinity: metrics.sessionAffinity } : {}),
    ...(metrics.kubernetesCpuHpa !== undefined ? { kubernetesCpuHpa: metrics.kubernetesCpuHpa } : {}),
    ...(metrics.cdnFlow !== undefined ? { cdnFlow: metrics.cdnFlow } : {}),
    ...(Array.isArray(metrics.loadBalancers)
      ? {
          loadBalancers: metrics.loadBalancers
            .filter((lb): lb is Record<string, unknown> => lb !== null && typeof lb === "object")
            .map((lb) => ({
              ...(str(lb.resourceId) !== undefined ? { resourceId: str(lb.resourceId) } : {}),
              ...(num(lb.routedRps) !== undefined ? { routedRps: num(lb.routedRps) } : {}),
            })),
        }
      : {}),
    // GPU / inference metrics — present only when the simulation contains a
    // GPU kubernetes resource with inferenceMode: true.
    ...(metrics.gpuUtilization !== undefined ? { gpuUtilization: metrics.gpuUtilization } : {}),
    ...(metrics.tokensPerSecond !== undefined ? { tokensPerSecond: metrics.tokensPerSecond } : {}),
    ...("costPerMillionTokens" in metrics ? { costPerMillionTokens: metrics.costPerMillionTokens } : {}),
    ...(metrics.idleGpuCostPerHour !== undefined ? { idleGpuCostPerHour: metrics.idleGpuCostPerHour } : {}),
    ...(metrics.idleGpuFraction !== undefined ? { idleGpuFraction: metrics.idleGpuFraction } : {}),
    ...(isErrorBreakdown(metrics.errorBreakdown) ? { errorBreakdown: metrics.errorBreakdown } : {}),
    ...(Array.isArray(metrics.databases) ? {
      ...(metrics.databases.some(db => db !== null && typeof db === "object" &&
        ("connectionDemandMode" in db || "declaredFleetConnectionBudget" in db)) ? {
          databaseConnectionDemand: metrics.databases
            .filter((db): db is Record<string, unknown> => db !== null && typeof db === "object" &&
              ("connectionDemandMode" in db || "declaredFleetConnectionBudget" in db))
            .map(db => ({
              resourceId: db.resourceId,
              connectionDemandMode: db.connectionDemandMode,
              loadDerivedConnections: db.loadDerivedConnections,
              loadDerivedBasis: db.loadDerivedBasis,
              declaredConnections: db.declaredConnections,
              idlePoolFloor: db.idlePoolFloor,
              modeledConnections: db.modeledConnections,
              connectionPressure: db.connectionPressure,
              declaredFleetConnectionBudget: db.declaredFleetConnectionBudget,
              declaredFleetConnectionPressure: db.declaredFleetConnectionPressure,
              declaredFleetConnectionBudgetBasis: db.declaredFleetConnectionBudgetBasis,
              declaredFleetConnectionBudgetTiers: db.declaredFleetConnectionBudgetTiers,
              assumption: db.declaredFleetConnectionBudget !== undefined
                ? "ASSUMPTION / maximum declared fleet × app pool size; not observed live DB connections"
                : "ASSUMPTION / plan-time budget; not observed live connections",
            })),
        } : {}),
      auroraFailovers: metrics.databases
        .filter((db): db is Record<string, unknown> => db !== null && typeof db === "object" &&
          db.auroraFailover !== undefined)
        .map(db => db.auroraFailover),
    } : {}),
    // Resilience telemetry — present only when simulation.resilienceConfig.enabled is true.
    // retryAmplificationFactor: null means the resilience model ran but produced no traffic (zero RPS).
    // Absent (not in response at all) means the resilience model is disabled.
    ...("retryAmplificationFactor" in metrics ? { retryAmplificationFactor: metrics.retryAmplificationFactor } : {}),
    // Bounded resilience diagnostics — incidentOutcome + path count only (paths array omitted for compactness).
    ...(metrics.resilience !== null && typeof metrics.resilience === "object"
      ? {
          resilienceDiagnostics: {
            incidentOutcome: (metrics.resilience as Record<string, unknown>).incidentOutcome,
            pathCount: Array.isArray((metrics.resilience as Record<string, unknown>).paths)
              ? ((metrics.resilience as Record<string, unknown>).paths as unknown[]).length
              : 0,
            bounded: (metrics.resilience as Record<string, unknown>).bounded,
            capacityByResource: (metrics.resilience as Record<string, unknown>).capacityByResource,
          },
        }
      : {}),
    ...compactExternalMetrics(metrics),
  };
  // Drop undefined top-level scalars so the JSON stays tight.
  for (const key of Object.keys(compact)) {
    if (compact[key] === undefined) delete compact[key];
  }
  return compact;
}
/** Shared per-resource compact status mapper (used by step and metrics shapers). */
function toCompactResources(rawResources: unknown[], rawEvents: unknown[] = []): Array<Record<string, unknown>> {
  const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
  const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
  return rawResources
    .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
    .map((r) => {
      const lifecycle = compactFailureTelemetry(r, rawEvents);
      const compact: Record<string, unknown> = {
        id: str(r.id),
        name: str(r.name),
        ...(r.location !== undefined ? { location: r.location } : {}),
        ...(r.characteristics !== null && typeof r.characteristics === "object" &&
          typeof (r.characteristics as Record<string, unknown>).replicaOf === "string"
          ? { replicaOf: (r.characteristics as Record<string, unknown>).replicaOf } : {}),
        ...(r.characteristics !== null && typeof r.characteristics === "object" &&
          typeof (r.characteristics as Record<string, unknown>).auroraReaderScalingMode === "string"
          ? { auroraReaderScalingMode: (r.characteristics as Record<string, unknown>).auroraReaderScalingMode } : {}),
        status: str(r.status),
        cpuPercent: num(r.cpuUsage),
        ...(r.routedRps !== undefined ? { routedRps: num(r.routedRps) } : {}),
        ...(r.availabilityState !== undefined ? { availabilityState: str(r.availabilityState) } : {}),
        ...(typeof r.isRoutable === "boolean" ? { isRoutable: r.isRoutable } : {}),
        ...(r.recoveryBlockedReason !== undefined
          ? { recoveryBlockedReason: str(r.recoveryBlockedReason) }
          : {}),
        ...(r.recoveryProgress !== undefined ? { recoveryProgress: r.recoveryProgress } : {}),
        ...(lifecycle.failureLifecycle !== undefined ? { failureLifecycle: lifecycle.failureLifecycle } : {}),
        ...(lifecycle.routingState !== undefined ? { routingState: lifecycle.routingState } : {}),
      };
      for (const key of Object.keys(compact)) {
        if (compact[key] === undefined) delete compact[key];
      }
      return compact;
    });
}

const COMPACT_FAILURE_LIFECYCLES = new Set([
  "quick_injection_parked",
  "quick_injection_rejoined",
  "instance_down",
  "instance_kill",
]);
const COMPACT_ROUTING_STATES = new Set(["unavailable", "serving"]);

/**
 * Project the backend's read-only failure lifecycle markers into compact
 * resource telemetry. The quick park counter is the only inferred value: it
 * is a server-side compatibility field that exists only for the bounded quick
 * inject-failure flow. Persistent failures remain represented by the existing
 * availability/routability fields, and lifecycle metadata is never invented
 * for ordinary resources.
 */
function compactFailureTelemetry(
  resource: Record<string, unknown>,
  rawEvents: unknown[],
): { failureLifecycle?: string; routingState?: string } {
  const acceptedLifecycle = (value: unknown): string | undefined =>
    typeof value === "string" && COMPACT_FAILURE_LIFECYCLES.has(value) ? value : undefined;
  const acceptedRouting = (value: unknown): string | undefined =>
    typeof value === "string" && COMPACT_ROUTING_STATES.has(value) ? value : undefined;

  let failureLifecycle = acceptedLifecycle(resource.failureLifecycle);
  let routingState = acceptedRouting(resource.routingState);

  // A quick park is surfaced on step responses through this read-only counter,
  // while its injection event is returned by the inject-failure operation.
  // Do not use recoveryProgress.state here: persistent instance_down recovery
  // also uses the parked state and must not be relabelled as a quick failure.
  if (
    failureLifecycle === undefined &&
    typeof resource.failureParkStepsRemaining === "number" &&
    resource.failureParkStepsRemaining > 0
  ) {
    failureLifecycle = "quick_injection_parked";
    routingState ??= "unavailable";
  }

  const resourceId = typeof resource.id === "string" ? resource.id : undefined;
  const resourceName = typeof resource.name === "string" ? resource.name : undefined;
  for (let i = rawEvents.length - 1; i >= 0 && (failureLifecycle === undefined || routingState === undefined); i--) {
    const event = rawEvents[i];
    if (event === null || typeof event !== "object") continue;
    const eventRecord = event as Record<string, unknown>;
    const metadata = eventRecord.metadata;
    if (metadata === null || typeof metadata !== "object") continue;
    const metadataRecord = metadata as Record<string, unknown>;
    const eventResource = eventRecord.resource;
    const metadataResourceId = metadataRecord.resourceId;
    if (
      (resourceId === undefined || metadataResourceId !== resourceId) &&
      (resourceName === undefined || eventResource !== resourceName)
    ) {
      continue;
    }
    failureLifecycle ??= acceptedLifecycle(metadataRecord.failureLifecycle);
    routingState ??= acceptedRouting(metadataRecord.routingState);
  }

  return { failureLifecycle, routingState };
}

/** Keep only the validated, additive error contributors in compact responses. */
function isErrorBreakdown(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const breakdown = value as Record<string, unknown>;
  const required = [
    "poolSaturation",
    "dbFailure",
    "computeFailure",
    "capacityOverload",
    "cpuOverload",
    "ociStorage",
    "queueAbsorption",
  ];
  return required.every((key) => typeof breakdown[key] === "number") &&
    (breakdown.databasePressure === undefined || typeof breakdown.databasePressure === "number") &&
    (breakdown.benchmarkReferenceFit === undefined || typeof breakdown.benchmarkReferenceFit === "number") &&
    (breakdown.runtimeMemory === undefined || typeof breakdown.runtimeMemory === "number") &&
    (breakdown.dependencyFailure === undefined || typeof breakdown.dependencyFailure === "number") &&
    (breakdown.poolSaturationDetails === undefined || Array.isArray(breakdown.poolSaturationDetails));
}

/** Derive a simulation-level status string: explicit `status` if present, else from `isRunning`. */
function simStatus(sim: Record<string, unknown>): string | undefined {
  if (typeof sim.status === "string") return sim.status;
  if (typeof sim.isRunning === "boolean") return sim.isRunning ? "running" : "stopped";
  return undefined;
}

/**
 * Compact create-response shaper. The full backend create response returns the
 * entire simulation object (all resource characteristics, connections,
 * topology metadata) — re-inflating agent prompts the same way full step
 * responses did. Compact mode returns id, name, status, traffic, the shared
 * per-resource summary, and normalizedConfig so agents can verify what CWM
 * actually modelled (resolved SKU, billing floor, autoscale thresholds, etc.).
 */
function toCompactCreateResponse(raw: unknown): Record<string, unknown> {
  const sim = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
  const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
  const compact: Record<string, unknown> = {
    id: str(sim.id),
    name: str(sim.name),
    engineVersion: str(sim.engineVersion),
    predictionEffectiveConfigHash: str(sim.predictionEffectiveConfigHash),
    calibrationEvidence: sim.calibrationEvidence,
    predictionEvidence: sim.predictionEvidence,
    appWeight: sim.appWeight,
    appWeightDefaulted: sim.appWeightDefaulted,
    predictionEvidenceStatus: sim.predictionEvidenceStatus,
    status: simStatus(sim),
    traffic: num(sim.traffic),
    ...(typeof sim.scenarioHash === "string" ? { scenarioHash: sim.scenarioHash } : {}),
    ...(typeof sim.effectiveConfigHash === "string" ? { effectiveConfigHash: sim.effectiveConfigHash } : {}),
    ...(sim.scenarioAttribution !== undefined ? { scenarioAttribution: sim.scenarioAttribution } : {}),
    ...(sim.replayIdentity !== undefined ? { replayIdentity: sim.replayIdentity } : {}),
    resources: toCompactResources(Array.isArray(sim.resources) ? sim.resources : []),
    effectiveMaxInstances: num(sim.effectiveMaxInstances),
    effectiveMinInstances: num(sim.effectiveMinInstances),
    ...(sim.autoscalingConfig !== undefined ? { autoscalingConfig: sim.autoscalingConfig } : {}),
    ...(sim.resilienceConfig !== undefined ? { resilienceConfig: sim.resilienceConfig } : {}),
    // Always pass normalizedConfig through when present — agents use it to
    // verify the resolved GPU SKU, billing floor, autoscale thresholds, and
    // cost multipliers immediately after create without an extra round-trip.
    ...(sim.normalizedConfig !== undefined ? { normalizedConfig: sim.normalizedConfig } : {}),
    ...(sim.hpaAudit !== undefined ? { hpaAudit: sim.hpaAudit } : {}),
  };
  for (const key of Object.keys(compact)) {
    if (compact[key] === undefined) delete compact[key];
  }
  return compact;
}

/**
 * Compact list-item shaper (simulation.list). Each entry keeps only id, name,
 * status, and the resource count — enough for an agent to pick a simulation
 * without pulling every resource object into the prompt.
 */
function toCompactListItems(items: unknown[]): Array<Record<string, unknown>> {
  const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
  return items
    .filter((s): s is Record<string, unknown> => s !== null && typeof s === "object")
    .map((s) => {
      const compact: Record<string, unknown> = {
        id: str(s.id),
        name: str(s.name),
        status: simStatus(s),
        resourceCount: Array.isArray(s.resources) ? s.resources.length : 0,
      };
      for (const key of Object.keys(compact)) {
        if (compact[key] === undefined) delete compact[key];
      }
      return compact;
    });
}

/** Number of trailing metrics-history entries kept in compact simulation.metrics responses. */
const METRICS_HISTORY_TAIL = 10;

/**
 * Compact metrics-response shaper (mirrors toCompactStepResponse). The full
 * response includes the entire simulation object plus the complete metrics
 * history — thousands of tokens that compound into every poll between steps.
 * Compact mode returns principal current metrics, per-resource status, and a
 * bounded history tail (last METRICS_HISTORY_TAIL entries).
 */
export function toCompactMetricsResponse(
  simulationRaw: unknown,
  metrics: unknown[],
  lastCostPerHour?: number
): Record<string, unknown> {
  const simulation =
    simulationRaw !== null && typeof simulationRaw === "object"
      ? (simulationRaw as Record<string, unknown>)
      : {};
  const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
  const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
  const latest =
    metrics.length > 0 && metrics[metrics.length - 1] !== null && typeof metrics[metrics.length - 1] === "object"
      ? (metrics[metrics.length - 1] as Record<string, unknown>)
      : {};
  const latencyUnavailable = (value: Record<string, unknown>) => {
    const evidence = value.predictionEvidence;
    const availability = evidence !== null && typeof evidence === "object"
      ? (evidence as Record<string, unknown>).latencyAvailability
      : undefined;
    return availability !== null && typeof availability === "object" &&
      (availability as Record<string, unknown>).status === "unavailable";
  };
  const latencyValue = (field: string) => latencyUnavailable(latest) ? null : num(latest[field]);
  const compactHistory = metrics.slice(-METRICS_HISTORY_TAIL).map((entry) => {
    if (entry === null || typeof entry !== "object") return entry;
    const row = entry as Record<string, unknown>;
    const contracted = addMcpGoodputContract(row);
    return latencyUnavailable(row)
      ? {
          ...contracted,
          latencyP50: null,
          latencyP95: null,
          latencyP99: null,
          latencyAvailability: (row.predictionEvidence as Record<string, unknown>).latencyAvailability,
        }
      : contracted;
  });

  const compact: Record<string, unknown> = {
    simulationId: str(simulation.id),
    scenarioHash: str(simulation.scenarioHash),
    effectiveConfigHash: str(simulation.effectiveConfigHash),
    replayIdentity: simulation.replayIdentity,
    engineVersion: str(simulation.engineVersion),
    predictionEffectiveConfigHash: str(
      latest.predictionEffectiveConfigHash ?? simulation.predictionEffectiveConfigHash,
    ),
    calibrationEvidence: latest.calibrationEvidence ?? simulation.calibrationEvidence,
    predictionEvidence: latest.predictionEvidence,
    predictionEvidenceStatus: latest.predictionEvidenceStatus,
    latencyAvailability: latest.latencyAvailability ?? (latest.predictionEvidence as Record<string, unknown> | undefined)?.latencyAvailability,
    appWeight: simulation.appWeight,
    appWeightDefaulted: simulation.appWeightDefaulted,
    currentStep: num(simulation.currentTime),
    traffic: num(simulation.traffic),
    latencyP50: latencyValue("latencyP50"),
    latencyP95: latencyValue("latencyP95"),
    latencyP99: latencyValue("latencyP99"),
    latencyP99Basis: str(latest.latencyP99Basis),
    latencyBasis: str(latest.latencyBasis),
    errorRate: num(latest.errorRate),
    throughput: num(latest.throughput),
    goodputRps: num(latest.throughput),
    goodputSemantics: "post_step_point_rate",
    goodputProvenance: {
      kind: "derived",
      sourceFields: ["metrics.throughput"],
    },
    goodputWindow: goodputWindowFromPersistedMetrics(
      str(simulation.id) ?? "",
      metrics,
    ),
    offeredRps: num(latest.offeredRps),
    modeledShedRps: num(latest.modeledShedRps),
    costPerHour: num(latest.costPerHour) ?? lastCostPerHour,
    residualCostPerHour: num(latest.residualCostPerHour),
    residualCostDefinition: str(latest.residualCostDefinition),
    metricId: str(latest.metricId),
    ...(latest.kubernetesCpuHpa !== undefined ? { kubernetesCpuHpa: latest.kubernetesCpuHpa } : {}),
    resources: toCompactResources(Array.isArray(simulation.resources) ? simulation.resources : []),
    metricsHistoryLength: metrics.length,
    metrics: compactHistory,
    ...compactEksEvidence(latest),
    eksSpotEvidenceHistory: metrics
      .map((entry) => entry !== null && typeof entry === "object"
        ? { entry: entry as Record<string, unknown> }
        : undefined)
      .filter((value): value is { entry: Record<string, unknown> } => value !== undefined &&
        (value.entry.eksSpotMigration !== undefined || value.entry.eksSpotMigrations !== undefined || value.entry.eksSpotInterruptions !== undefined))
      .map(({ entry }) => ({
        metricId: typeof entry.metricId === "string" ? entry.metricId : undefined,
        engineInputStepIndex: typeof entry.timestamp === "number" ? entry.timestamp : undefined,
        ...compactEksEvidence(entry),
      })),
    ...(isErrorBreakdown(latest.errorBreakdown) ? { errorBreakdown: latest.errorBreakdown } : {}),
    ...(latest.sessionAffinity !== undefined ? { sessionAffinity: latest.sessionAffinity } : {}),
    ...(latest.cdnFlow !== undefined ? { cdnFlow: latest.cdnFlow } : {}),
    ...(Array.isArray(latest.databases) ? {
      ...(latest.databases.some(db => db !== null && typeof db === "object" &&
        ("connectionDemandMode" in db || "declaredFleetConnectionBudget" in db)) ? {
          databaseConnectionDemand: latest.databases
            .filter((db): db is Record<string, unknown> => db !== null && typeof db === "object" &&
              ("connectionDemandMode" in db || "declaredFleetConnectionBudget" in db))
            .map(db => ({
              resourceId: db.resourceId,
              connectionDemandMode: db.connectionDemandMode,
              loadDerivedConnections: db.loadDerivedConnections,
              loadDerivedBasis: db.loadDerivedBasis,
              declaredConnections: db.declaredConnections,
              idlePoolFloor: db.idlePoolFloor,
              modeledConnections: db.modeledConnections,
              connectionPressure: db.connectionPressure,
              declaredFleetConnectionBudget: db.declaredFleetConnectionBudget,
              declaredFleetConnectionPressure: db.declaredFleetConnectionPressure,
              declaredFleetConnectionBudgetBasis: db.declaredFleetConnectionBudgetBasis,
              declaredFleetConnectionBudgetTiers: db.declaredFleetConnectionBudgetTiers,
              assumption: db.declaredFleetConnectionBudget !== undefined
                ? "ASSUMPTION / maximum declared fleet × app pool size; not observed live DB connections"
                : "ASSUMPTION / plan-time budget; not observed live connections",
            })),
        } : {}),
      auroraFailovers: latest.databases
        .filter((db): db is Record<string, unknown> => db !== null && typeof db === "object" &&
          db.auroraFailover !== undefined)
        .map(db => db.auroraFailover),
    } : {}),
    // GPU / inference metrics — present only when the simulation contains a
    // GPU kubernetes resource with inferenceMode: true.
    ...(latest.gpuUtilization !== undefined ? { gpuUtilization: latest.gpuUtilization } : {}),
    ...(latest.tokensPerSecond !== undefined ? { tokensPerSecond: latest.tokensPerSecond } : {}),
    ...("costPerMillionTokens" in latest ? { costPerMillionTokens: latest.costPerMillionTokens } : {}),
    ...(latest.idleGpuCostPerHour !== undefined ? { idleGpuCostPerHour: latest.idleGpuCostPerHour } : {}),
    ...(latest.idleGpuFraction !== undefined ? { idleGpuFraction: latest.idleGpuFraction } : {}),
    // Resilience telemetry from the latest step — present only when the resilience model ran.
    ...("retryAmplificationFactor" in latest ? { retryAmplificationFactor: latest.retryAmplificationFactor } : {}),
    ...(latest.resilience !== null && typeof latest.resilience === "object"
      ? {
          resilienceDiagnostics: {
            incidentOutcome: (latest.resilience as Record<string, unknown>).incidentOutcome,
            pathCount: Array.isArray((latest.resilience as Record<string, unknown>).paths)
              ? ((latest.resilience as Record<string, unknown>).paths as unknown[]).length
              : 0,
            bounded: (latest.resilience as Record<string, unknown>).bounded,
            capacityByResource: (latest.resilience as Record<string, unknown>).capacityByResource,
          },
        }
      : {}),
    ...compactExternalMetrics(latest),
  };
  for (const key of Object.keys(compact)) {
    if (compact[key] === undefined) delete compact[key];
  }
  return compact;
}

function compactExternalMetrics(metrics: Record<string, unknown>): Record<string, unknown> {
  const resilience = metrics.resilience;
  if (resilience === null || typeof resilience !== "object" ||
      (resilience as Record<string, unknown>).externalMetrics === undefined) {
    return {};
  }
  return { externalMetrics: (resilience as Record<string, unknown>).externalMetrics };
}

function compactEksEvidence(metrics: Record<string, unknown>): Record<string, unknown> {
  const evidence: Record<string, unknown> = {};
  for (const key of [
    "eksSpotMigration",
    "eksSpotMigrations",
    "eksSpotMigrationEvents",
    "eksSpotInterruptions",
  ]) {
    if (metrics[key] !== undefined) evidence[key] = metrics[key];
  }
  return evidence;
}

/**
 * Legacy event rows store their discriminator in metadata.kind. MCP exposes a
 * stable top-level type while preserving the original metadata unchanged.
 */
function toMcpEvent(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object") return raw;
  const event = raw as Record<string, unknown>;
  return {
    ...event,
    type: typeof event.type === "string" && event.type.trim()
      ? event.type
      : (() => {
          const metadata = event.metadata;
          const kind = metadata !== null && typeof metadata === "object"
            ? (metadata as Record<string, unknown>).kind
            : undefined;
          return typeof kind === "string" && kind.trim() ? kind : "simulation_event";
        })(),
  };
}

function addMcpGoodputContract(metric: Record<string, unknown>): Record<string, unknown> {
  if (typeof metric.throughput !== "number" || !Number.isFinite(metric.throughput)) return metric;
  return {
    ...metric,
    goodputRps: metric.throughput,
    goodputSemantics: "post_step_point_rate",
    goodputProvenance: {
      kind: "derived",
      sourceFields: ["metrics.throughput"],
    },
  };
}

export function addMcpGoodputToFullResponse(raw: unknown): Record<string, unknown> {
  const response = raw !== null && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const withEvents = Array.isArray(response.events)
    ? { ...response, events: response.events.map(toMcpEvent) }
    : response;
  const metrics = withEvents.metrics;
  const simulation = withEvents.simulation;
  const simulationId = simulation !== null && typeof simulation === "object" &&
    typeof (simulation as Record<string, unknown>).id === "string"
    ? (simulation as Record<string, unknown>).id as string
    : "";
  if (Array.isArray(metrics)) {
    return {
      ...withEvents,
      goodputWindow: goodputWindowFromPersistedMetrics(simulationId, metrics),
      metrics: metrics.map((entry) =>
        entry !== null && typeof entry === "object"
          ? addMcpGoodputContract(entry as Record<string, unknown>)
          : entry
      ),
    };
  }
  if (metrics !== null && typeof metrics === "object") {
    return {
      ...withEvents,
      goodputWindow: goodputWindowFromPersistedMetrics(simulationId, [metrics]),
      metrics: addMcpGoodputContract(metrics as Record<string, unknown>),
    };
  }
  return {
    ...withEvents,
    goodputWindow: goodputWindowFromPersistedMetrics(simulationId, []),
  };
}

function structuredResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

function currentStepFromResponse(value: unknown): number | undefined {
  const response = value !== null && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  if (typeof response.currentStep === "number") return response.currentStep;
  if (typeof response.currentTime === "number") return response.currentTime;
  const simulation = response.simulation !== null && typeof response.simulation === "object"
    ? response.simulation as Record<string, unknown>
    : {};
  return typeof simulation.currentTime === "number" ? simulation.currentTime : undefined;
}

async function stepResponseResult(value: unknown, readCurrentState?: () => Promise<unknown>) {
  const parsed = stepOutputSchema.safeParse(value);
  if (parsed.success) return structuredResult(value);

  let currentStep = currentStepFromResponse(value);
  if (currentStep === undefined && readCurrentState) {
    try {
      currentStep = currentStepFromResponse(await readCurrentState());
    } catch {
      // Preserve the applied-state warning if the read-only state lookup fails.
    }
  }
  const issue = parsed.error.issues[0];
  const issuePath = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  const detail = issue ? `${issuePath}${issue.message}` : "unknown output-schema mismatch";
  return errorResult(
    `Simulation step was applied, but the MCP response failed validation. ` +
    `currentStep=${currentStep === undefined ? "unknown" : currentStep}. ` +
    `Do not retry this step; inspect simulation.metrics before proceeding. ` +
    `Response validation error: ${detail}`,
  );
}

function arrayResult(items: unknown[], objectKey: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(items, null, 2) }],
    structuredContent: { [objectKey]: items } as Record<string, unknown>,
  };
}

const providerApiLimitMcpInputSchema = {
  simulationId: z
    .string()
    .min(1)
    .describe("Owned simulation ID used for access control and result context; the workload is not persisted"),
  ...providerApiLimitSimulationRequestSchema.innerType().shape,
};

const providerApiLimitMcpOutputSchema = z
  .object({
    simulation: z
      .object({
        id: z.string(),
        name: z.string(),
        currentTime: z.number(),
      })
      .strict()
      .describe("Owned simulation context; provider-limit work does not advance this state"),
    modeled: z
      .object({
        namespace: z.literal("simulated-provider-api-quota"),
        platformRateLimitNamespace: z.literal("cwm-api-rate-limit"),
        providerThrottlingIsModeled: z.literal(true),
        platformHttpRateLimitsAreNotModeled: z.literal(true),
      })
      .strict()
      .describe("Explicit boundary between modeled provider throttling and CWM HTTP rate limiting"),
    request: z
      .record(z.unknown())
      .describe("Normalized bounded provider-limit request, including any caller-supplied overrides"),
    result: z
      .record(z.unknown())
      .describe("Deterministic scheduler result with policy resolutions, accounting, queue, timing, and outcomes"),
    provenance: z
      .object({
        catalogVersion: z.number().int().positive(),
        policies: z.array(z.record(z.unknown())),
      })
      .strict()
      .describe("Catalog or caller-override source metadata, including source references and as-of dates"),
  })
  .strict();

/**
 * Keep scenario discovery bounded. The live REST scenario library remains the
 * source of truth, but topology and experiment graphs are hydrated separately
 * by scenario.get so a catalog call stays cheap and safe to repeat.
 *
 * Compact card descriptions are capped at 500 characters. Longer descriptions
 * keep their deterministic prefix and end with a Unicode ellipsis marker.
 */
export const SCENARIO_CARD_DESCRIPTION_MAX_LENGTH = 500;
const SCENARIO_CARD_DESCRIPTION_TRUNCATION_MARKER = "…";

function compactScenarioDescription(value: unknown): string {
  const description = typeof value === "string" ? value : "";
  if (description.length <= SCENARIO_CARD_DESCRIPTION_MAX_LENGTH) return description;

  const contentLength =
    SCENARIO_CARD_DESCRIPTION_MAX_LENGTH - SCENARIO_CARD_DESCRIPTION_TRUNCATION_MARKER.length;
  return `${description.slice(0, contentLength).trimEnd()}${SCENARIO_CARD_DESCRIPTION_TRUNCATION_MARKER}`;
}

type ScenarioTrafficPattern = NonNullable<Scenario["defaultTrafficPatterns"]>[number];
type ScenarioTrafficPhaseSummary = z.infer<typeof scenarioTrafficPhaseSummarySchema>;

function scenarioPatternEnd(pattern: ScenarioTrafficPattern): number | undefined {
  return pattern.endTime ?? (
    pattern.parameters.duration !== undefined
      ? pattern.startTime + pattern.parameters.duration
      : undefined
  );
}

function toScenarioTrafficPhaseSummary(
  pattern: ScenarioTrafficPattern,
): ScenarioTrafficPhaseSummary {
  const { startTraffic, endTraffic, peakTraffic } = pattern.parameters;
  const endStep = scenarioPatternEnd(pattern);
  return {
    name: pattern.name,
    type: pattern.type,
    startStep: pattern.startTime,
    ...(endStep !== undefined ? { endStep } : {}),
    isActive: pattern.isActive !== false,
    traffic: {
      ...(startTraffic !== undefined ? { startRps: startTraffic } : {}),
      ...(endTraffic !== undefined ? { endRps: endTraffic } : {}),
      ...(peakTraffic !== undefined ? { peakRps: peakTraffic } : {}),
    },
  };
}

function scenarioRetryTrafficDisclosure(
  scenario: Record<string, unknown>,
  activePhases: ScenarioTrafficPhaseSummary[],
): z.infer<typeof scenarioRetryTrafficDisclosureSchema> | undefined {
  const resilienceConfig = scenario.resilienceConfig;
  if (resilienceConfig === null || typeof resilienceConfig !== "object") return undefined;
  const config = resilienceConfig as Record<string, unknown>;
  if (config.enabled !== true || !Array.isArray(config.dependencies)) return undefined;

  const retryDependencies = config.dependencies.filter((dependency): dependency is Record<string, unknown> => {
    if (dependency === null || typeof dependency !== "object") return false;
    const retryPolicy = (dependency as Record<string, unknown>).retryPolicy;
    if (retryPolicy === null || typeof retryPolicy !== "object") return false;
    const policy = retryPolicy as Record<string, unknown>;
    return typeof policy.maxRetries === "number" &&
      policy.maxRetries > 0 &&
      typeof policy.retryBudgetRatio === "number" &&
      policy.retryBudgetRatio > 0;
  });
  if (retryDependencies.length === 0) return undefined;

  const maxConfiguredRetries = Math.max(...retryDependencies.map((dependency) => {
    const policy = dependency.retryPolicy as Record<string, unknown>;
    return policy.maxRetries as number;
  }));
  const firstPhase = activePhases[0];
  const startRps = firstPhase?.traffic.startRps;
  const externalTraffic = startRps !== undefined
    ? `External traffic follows the listed phases, starting at ${startRps.toLocaleString()} RPS.`
    : "External traffic follows the listed phases.";

  return {
    enabled: true,
    dependencyCount: retryDependencies.length,
    maxConfiguredRetries,
    externalTraffic,
    internalRetryAttempts:
      "Configured dependency retries can increase internal request volume after failures; retry attempts are internal, not additional external traffic.",
  };
}

function scenarioTrafficDisclosure(raw: Record<string, unknown>): {
  activeTrafficPhases: ScenarioTrafficPhaseSummary[];
  optionalTrafficPhases: ScenarioTrafficPhaseSummary[];
  retryTrafficDisclosure?: z.infer<typeof scenarioRetryTrafficDisclosureSchema>;
} {
  const patterns = Array.isArray(raw.defaultTrafficPatterns)
    ? raw.defaultTrafficPatterns.filter((pattern): pattern is ScenarioTrafficPattern =>
      pattern !== null && typeof pattern === "object",
    )
    : [];
  const phases = patterns.map(toScenarioTrafficPhaseSummary);
  const activeTrafficPhases = phases.filter((phase) => phase.isActive);
  const optionalTrafficPhases = phases.filter((phase) => !phase.isActive);
  return {
    activeTrafficPhases,
    optionalTrafficPhases,
    retryTrafficDisclosure: scenarioRetryTrafficDisclosure(raw, activeTrafficPhases),
  };
}

function scenarioFailureDisclosure(raw: Record<string, unknown>) {
  const presets = Array.isArray(raw.defaultFailureInjections) ? raw.defaultFailureInjections : [];
  const phases = presets.map((rawPreset) => {
    const preset = scenarioDefaultFailureInjectionSchema.parse(rawPreset);
    const endStep = preset.endTime ?? (
      preset.duration !== undefined ? preset.startTime + preset.duration : undefined
    );
    return {
      name: preset.name,
      type: preset.type,
      ...(preset.targetResourceId !== undefined ? { targetResourceId: preset.targetResourceId } : {}),
      ...(preset.targetZone !== undefined ? { targetZone: preset.targetZone } : {}),
      ...(preset.targetRegion !== undefined ? { targetRegion: preset.targetRegion } : {}),
      ...(preset.targetProvider !== undefined ? { targetProvider: preset.targetProvider } : {}),
      severity: preset.severity,
      isActive: preset.isActive,
      startStep: preset.startTime,
      ...(endStep !== undefined ? { endStep } : {}),
    };
  });
  return {
    activeFailurePhases: phases.filter((phase) => phase.isActive),
    optionalFailurePhases: phases.filter((phase) => !phase.isActive),
  };
}

export function toCompactScenarioCard(raw: unknown): Record<string, unknown> {
  const scenario = raw !== null && typeof raw === "object"
    ? raw as Record<string, unknown>
    : {};
  const resources = Array.isArray(scenario.resources) ? scenario.resources : [];
  const connections = Array.isArray(scenario.connections) ? scenario.connections : [];
  const providers = Array.from(new Set(
    resources
      .filter((resource): resource is Record<string, unknown> => resource !== null && typeof resource === "object")
      .map((resource) => resource.provider)
      .filter((provider): provider is string => typeof provider === "string" && provider.length > 0),
  ));
  const title = typeof scenario.title === "string"
    ? scenario.title
    : typeof scenario.name === "string"
      ? scenario.name
      : String(scenario.id ?? "");
  const trafficDisclosure = scenarioTrafficDisclosure(scenario);
  return {
    id: String(scenario.id ?? ""),
    title,
    name: title,
    description: compactScenarioDescription(scenario.description),
    version: scenario.version ?? null,
    revision: scenario.revision ?? null,
    difficulty: scenario.difficulty,
    tags: Array.isArray(scenario.tags) ? scenario.tags : [],
    category: typeof scenario.category === "string" ? scenario.category : "",
    primaryPurpose: typeof scenario.primaryPurpose === "string" ? scenario.primaryPurpose : undefined,
    duration: typeof scenario.duration === "string" ? scenario.duration : "",
    provider: providers[0],
    providers,
    providerSummary: providers.length > 0 ? providers.join(", ") : "unknown",
    resourceCount: resources.length,
    connectionCount: connections.length,
    ...trafficDisclosure,
    ...scenarioFailureDisclosure(scenario),
  };
}

function hydrateScenario(raw: unknown): Record<string, unknown> {
  const scenario = raw !== null && typeof raw === "object"
    ? raw as Record<string, unknown>
    : {};
  const title = typeof scenario.title === "string"
    ? scenario.title
    : typeof scenario.name === "string"
      ? scenario.name
      : String(scenario.id ?? "");
  return {
    ...scenario,
    title,
    name: title,
    version: scenario.version ?? null,
    revision: scenario.revision ?? null,
    ...scenarioTrafficDisclosure(scenario),
    ...scenarioFailureDisclosure(scenario),
  };
}

const scenarioCardSchema = z.object({
  activeFailurePhases: z.array(scenarioFailurePhaseSummarySchema).optional()
    .describe("Scheduled active failures: name, type, target resource/zone, severity and step range; no parameters"),
  optionalFailurePhases: z.array(scenarioFailurePhaseSummarySchema).optional()
    .describe("Disabled optional failure presets; not scheduled unless enabled"),
  id: z.string().optional().describe("Stable scenario identifier — pass to scenario.get"),
  title: z.string().optional().describe("Scenario title"),
  name: z.string().optional().describe("Scenario display name; equivalent to title"),
  description: z
    .string()
    .optional()
    .describe("What this scenario demonstrates; capped at 500 characters with an ellipsis when truncated"),
  difficulty: z.string().optional().describe("Scenario difficulty"),
  tags: z.array(z.string()).optional().describe("Discovery tags"),
  category: z.string().optional().describe("Scenario category"),
  version: z.string().nullable().optional().describe("Catalog version; null when unavailable"),
  revision: z.string().nullable().optional().describe("Catalog revision; null when unavailable"),
  primaryPurpose: z
    .enum(["educational", "chaos", "predictive", "optimization"])
    .optional()
    .describe("Primary purpose: educational guided scenario, chaos injected failure, predictive capacity simulation, or optimization configuration comparison"),
  duration: z.string().optional().describe("Expected scenario duration"),
  provider: z.string().optional().describe("Primary cloud provider"),
  providers: z.array(z.string()).optional().describe("Cloud providers represented in the scenario"),
  providerSummary: z.string().optional().describe("Compact provider summary"),
  resourceCount: z.number().optional().describe("Number of resources in the scenario graph"),
  connectionCount: z.number().optional().describe("Number of connections in the scenario graph"),
  activeTrafficPhases: z
    .array(scenarioTrafficPhaseSummarySchema)
    .optional()
    .describe("Named active catalog traffic phases with type, step range, and workload shape"),
  optionalTrafficPhases: z
    .array(scenarioTrafficPhaseSummarySchema)
    .optional()
    .describe("Named optional catalog traffic phases; these are inactive until enabled in the workspace"),
  retryTrafficDisclosure: scenarioRetryTrafficDisclosureSchema
    .optional()
    .describe("When present, separates external catalog traffic from modeled internal retry attempts"),
}).passthrough();

const scenarioListInputSchema = {
  provider: z
    .enum(["aws", "gcp", "azure", "oci", "digitalocean"])
    .optional()
    .describe("Only scenarios that include resources from this cloud provider"),
  category: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Only scenarios in this category, such as scaling, failure, reliability, networking, or cost"),
  difficulty: z
    .enum(["beginner", "intermediate", "advanced"])
    .optional()
    .describe("Only scenarios at this difficulty level"),
};

function scenarioListPath(filters: {
  provider?: string;
  category?: string;
  difficulty?: string;
}): string {
  const params = new URLSearchParams();
  if (filters.provider !== undefined) params.set("provider", filters.provider);
  if (filters.category !== undefined) params.set("category", filters.category);
  if (filters.difficulty !== undefined) params.set("difficulty", filters.difficulty);
  const query = params.toString();
  return query ? `/api/scenarios?${query}` : "/api/scenarios";
}

const scenarioGetOutputSchema = z.object({
  status: z.string().optional().describe("Result status; not_found when the requested scenario does not exist"),
  message: z.string().optional().describe("Error or guidance message"),
  id: z.string().optional().describe("Stable scenario identifier"),
  title: z.string().optional().describe("Scenario title"),
  name: z.string().optional().describe("Scenario display name; equivalent to title"),
  description: z.string().optional(),
  difficulty: z.string().optional(),
  resources: z.array(z.record(z.unknown())).optional().describe("Full resource graph; pass to simulation.create"),
  connections: z.array(z.record(z.unknown())).optional().describe("Full connection graph; pass to simulation.create"),
  duration: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  primaryPurpose: z
    .enum(["educational", "chaos", "predictive", "optimization"])
    .optional()
    .describe("Primary purpose of the scenario; absent means legacy purpose not specified"),
  seed: z.number().int().min(0).optional(),
  resilienceConfig: z.record(z.unknown()).optional(),
  protectedResilienceConfig: z.record(z.unknown()).optional(),
  defaultTrafficPatterns: z.array(z.record(z.unknown())).optional(),
  defaultFailureInjections: z.array(z.record(z.unknown())).optional(),
  activeFailurePhases: z.array(scenarioFailurePhaseSummarySchema).optional(),
  optionalFailurePhases: z.array(scenarioFailurePhaseSummarySchema).optional(),
  activeTrafficPhases: z.array(scenarioTrafficPhaseSummarySchema).optional(),
  optionalTrafficPhases: z.array(scenarioTrafficPhaseSummarySchema).optional(),
  retryTrafficDisclosure: scenarioRetryTrafficDisclosureSchema.optional(),
  realWorldIncident: z.record(z.unknown()).optional(),
}).passthrough();

const SCENARIO_CREATE_GUIDANCE =
  "Built-in scenario workflow: call `scenario.list` and pass a returned card's `id` as `scenarioId` to `simulation.create` for server-side graph expansion. " +
  "For full control, call `scenario.get` and pass its hydrated `resources` and `connections` arrays instead. These are two alternatives — do not send `scenarioId` with `resources` or `connections`. " +
  "For the catalog EKS Spot Interruption Migration scenario, you may set `scenarioOverrides: { eksSpotInterruption: { startupSeconds } }` with an integer startupSeconds from 0 through 3600 to test a different readiness deadline without copying the graph; this override requires scenarioId and is mutually exclusive with resources and connections. " +
  "For the Web App Autoscaling scenario, create with `scenarioId: \"web-autoscaling\"` and `scenarioOverrides: { webAutoscaling: { includeTrafficRecovery: true } }` to activate the optional Traffic Recovery ramp and observe scale-in. `includeTrafficRecovery` is optional and defaults to false, leaving the phase inactive. Opt in before the first simulation.step because replay identity is finalized when stepping starts. This override also requires scenarioId and is mutually exclusive with resources and connections. " +
  "`scenario.list` returns graph-free cards with bounded active/optional traffic-phase and retry-workload summaries; it is not a source of resource, connection, traffic-pattern, or failure-injection graphs. Scenario traffic and failure presets are not applied automatically. ";

const SCENARIO_RESOURCES_INPUT_DESCRIPTION =
  "List of cloud resources composing this simulation. For a built-in scenario, pass the hydrated resources from scenario.get; scenario.list cards are graph-free.";

const SCENARIO_CONNECTIONS_INPUT_DESCRIPTION =
  "Directed connections between resources. For a built-in scenario, pass the hydrated connections from scenario.get; scenario.list cards are graph-free.";

/**
 * The REST metrics endpoints return `{ metrics: [...], lastCostPerHour }`, but
 * the MCP output schemas declare `metrics` as an ARRAY. Unwrap the envelope so
 * structured-output validation passes; `lastCostPerHour` is surfaced top-level
 * (the output schemas are .passthrough()).
 */
function unwrapMetricsResponse(raw: unknown): { metrics: unknown[]; lastCostPerHour?: number } {
  if (Array.isArray(raw)) return { metrics: raw };
  if (raw && typeof raw === "object") {
    const obj = raw as { metrics?: unknown; lastCostPerHour?: unknown };
    const metrics = Array.isArray(obj.metrics) ? obj.metrics : [];
    return typeof obj.lastCostPerHour === "number"
      ? { metrics, lastCostPerHour: obj.lastCostPerHour }
      : { metrics };
  }
  return { metrics: [] };
}

/** Single source of truth for the api.spec payload across both transports. */
function apiSpecPayload(ctx: ToolContext) {
  return {
    openapi_spec_url: `${ctx.specBaseUrl ?? ctx.baseUrl}/api-docs/openapi.json`,
    openapi_spec_format: "openapi3_json",
    description:
      "Fetch openapi_spec_url to retrieve the full OpenAPI 3.0 specification in JSON format. " +
      "It documents every REST endpoint, request schema, response schema, and authentication requirement " +
      "for this Cloud World Model instance.",
  };
}

// Keep MCP creation compatible with the complete public resilience contract.
// scenario.get returns hydrated resilience configuration for simulation.create,
// so this schema must evolve with the shared model rather than silently
// stripping newer fault, scaling, or retry-attribution fields.
const mcpResilienceConfigSchema = z.object({
  enabled: z.boolean().optional().describe("Master switch for retry/cascade modeling"),
  version: z.literal(1).optional().describe("Resilience model version"),
  dependencies: z.array(z.object({
    id: z.string().min(1).max(128).describe("Unique dependency edge ID"),
    sourceId: z.string().min(1).describe("Upstream resource ID"),
    targetId: z.string().min(1).describe("Downstream resource ID"),
    requestRatio: z.number().min(0).max(20).optional().describe("Requests to target per original request"),
    authRequestsPerAttempt: z.number().min(0).max(10).optional().describe("Auth/token requests generated per dependency attempt"),
    authDependencyId: z.string().min(1).max(128).optional().describe("Dependency receiving generated auth/token traffic"),
    retryPolicy: z.object({
      maxRetries: z.number().int().min(0).max(8).optional()
        .describe("Maximum retries for this dependency edge (0 disables retries; default 2)."),
      backoffMs: z.number().int().min(0).max(60000).optional()
        .describe("Initial retry backoff in milliseconds (default 100)."),
      backoffMultiplier: z.number().min(1).max(10).optional()
        .describe("Exponential backoff multiplier (default 2)."),
      jitterRatio: z.number().min(0).max(1).optional()
        .describe("Fractional backoff jitter from 0 to 1 (default 0.1)."),
      timeoutMs: z.number().int().min(1).max(120000).optional()
        .describe("Per-attempt client deadline in milliseconds (default 2000); includes queue wait, service, and latency."),
      retryBudgetRatio: z.number().min(0).max(10).optional()
        .describe("Retry RPS budget as a multiple of original edge RPS (default 2)."),
      retryBudgetRps: z.number().min(0).max(500000).optional()
        .describe("Optional absolute retry RPS cap, also bounded by retryBudgetRatio."),
      retryActorId: z.string().min(1).max(128).optional().describe("Actor producing retries, such as a gateway or client"),
    }).optional(),
    protection: z.object({
      circuitBreaker: z.object({
        enabled: z.boolean().optional(),
        failureRateThreshold: z.number().min(0).max(1).optional(),
        minimumRequests: z.number().int().min(1).max(100000).optional(),
        openSteps: z.number().int().min(1).max(120).optional(),
        halfOpenMaxRequests: z.number().int().min(1).max(10000).optional(),
      }).optional(),
      rateLimitRps: z.number().positive().max(500000).optional(),
      loadShedding: z.boolean().optional(),
    }).optional(),
    capacity: z.object({
      maxRps: z.number().positive().max(500000).optional(),
      maxConcurrent: z.number().int().positive().max(1000000).optional(),
      meanServiceTimeMs: z.number().positive().max(120000).optional(),
    }).optional(),
  })).max(64).optional().describe("Dependency edges with retry and protection policies"),
  scheduledFaults: z.array(z.object({
    id: z.string().min(1).max(128),
    type: z.enum(["capacity_limit", "concurrency_limit", "latency", "error_rate", "traffic_surge"]).describe("Fault type; traffic_surge increases root client demand"),
    targetResourceId: z.string().optional(),
    dependencyId: z.string().optional(),
    startStep: z.number().int().min(0),
    endStep: z.number().int().min(1).optional(),
    capacityPercent: z.number().min(0).max(100).optional(),
    maxConcurrent: z.number().int().positive().max(1000000).optional(),
    addedLatencyMs: z.number().min(0).max(120000).optional(),
    errorRate: z.number().min(0).max(1).optional(),
    trafficMultiplier: z.number().gt(1).max(20).optional().describe("traffic_surge demand multiplier"),
  })).max(32).optional().describe("Scheduled capacity, error, latency, concurrency, or traffic-surge faults"),
  scalingPolicies: z.array(z.object({
    id: z.string().min(1).max(128),
    dependencyId: z.string().min(1).max(128),
    constrainedMetric: z.enum(["rps", "concurrency"]),
    observationMetric: z.enum(["source_cpu", "capacity_utilization"]),
    observedResourceId: z.string().min(1).optional(),
    scaleOutThresholdPercent: z.number().min(1).max(100),
    scaleOutCapacityMultiplier: z.number().min(1).max(20).optional(),
  })).max(32).optional().describe("Capacity-observation policies, including intentional autoscaling blind spots"),
  maxCascadeDepth: z.number().int().min(1).max(8).optional(),
  maxGeneratedRps: z.number().positive().max(500000).optional(),
  maxStepWork: z.number().int().min(1).max(2048).optional(),
  retryGeneratedTrafficAffectsCost: z.boolean().optional(),
  externalMetrics: externalMetricsConfigSchema.optional().describe(
    "Deterministic per-trigger recommendation inputs. A no_ready_endpoints sample is a successful zero only when that trigger sets noReadyEndpointsAsZero:true; discovery_error and fetch_error always remain errors. This is not a KEDA/provider actuator and does not change resource counts.",
  ),
});

/**
 * Register the full authenticated tool set on the given
 * McpServer. Shared by the internal test harness and the hosted Streamable HTTP
 * transport (server/mcp-http.ts) so their tool schemas cannot drift.
 */
export function registerTools(server: McpServer, ctx: ToolContext): void {

server.registerTool(
  "api.spec",
  {
    title: "Get API Spec",
    description:
      "Return the location and format of the Cloud World Model OpenAPI specification. " +
      "openapi_spec_url: /api-docs/openapi.json — fetch this path relative to the server base URL to retrieve the full machine-readable spec. " +
      "openapi_spec_format: openapi3_json — the spec is an OpenAPI 3.0 document in JSON format. " +
      "Use it only when you need REST endpoint details outside this MCP session (e.g. generating an HTTP client). " +
      "Do not call api.spec to learn the simulation workflow — the tool descriptions in this session contain everything needed: start with simulation.create or simulation.list. " +
      "No prerequisites, no API key required; the result is static per server, so one call per session is enough. Returns no identifiers consumed by other tools.",
    inputSchema: {},
    outputSchema: z
      .object({
        openapi_spec_url: z.string().describe("Absolute URL to the OpenAPI JSON specification"),
        openapi_spec_format: z.string().describe("Spec format identifier (e.g. openapi3_json)"),
        description: z.string().describe("Short description of the spec and how to use it"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  () => structuredResult(apiSpecPayload(ctx))
);

server.registerTool(
  "simulation.create",
  {
    title: "Create Simulation",
    description:
      "Create a new virtual cloud environment (simulation) with resources such as compute, database, storage, network, cache, queue, or kubernetes nodes. " +
      "resilienceConfig.externalMetrics is a deterministic sampled recommendation model: no_ready_endpoints is successful zero only when its trigger sets noReadyEndpointsAsZero:true; discovery_error and fetch_error always remain errors. It is not a KEDA/provider actuator and does not change resource counts. " +
      "Set retry behavior per dependency at resilienceConfig.dependencies[].retryPolicy, e.g. {id:'web-to-db',sourceId:'web-1',targetId:'db-1',retryPolicy:{timeoutMs:10000,maxRetries:0}}. Omitted values default to 2000 ms and 2 retries; simulation.update accepts the same resilienceConfig and returns its effective values. " +
      SCENARIO_CREATE_GUIDANCE +
      "P99 has distinct per-percentile provenance: latencyP99Basis identifies the owned in-VPC internal-ALB fit, a scaled-from-fit estimate (not directly measured), or an uncalibrated generic model. On the exact healthy lean owned graph at 10–1,000 offered target RPS, P99=max(final P95, 7.021919127633514 + 0.00027013891327780484*T) ms; only 10/100/500 RPS were fit, 1,000 RPS was held out. Lean M5 scaling is not a new measurement; typical/heavy and active failures retain uncalibrated P99. predictionEvidence.latencyP99 has measured 0.65–1.35×, scaled 0.50–1.50× (beyond 1,000: 0.25–2×), or uncalibrated 0.50–2× (beyond: 0.25–3×) assumption bounds centered on final P99. These are not confidence intervals or provider measurements. Historical evidence may omit P99. latencyBasis describes the general modeled latency path; use latencyP99Basis specifically for P99. P99 is diagnostic, not scored. " +
      "Use it as the entry point of every workflow — simulation stepping, RL training (rl.create), chaos experiments (chaos.run), and prediction validation (prediction.validate) all require a simulation id from this tool. " +
      "Do not use it to modify an existing simulation (use simulation.inject_traffic / simulation.resize) or to re-create one you already own (use simulation.list to find it). " +
      "For compute, set characteristics.capacityRps for an explicit per-node RPS ceiling at which CPU reaches ~95%; do not use maxThroughput for that compute contract. Kubernetes rejects capacityRps: set maxThroughput for the total cluster RPS ceiling, or nodePools[].maxThroughput for per-node pool capacity. Omitted compute capacityRps uses the selected catalog tier and can intentionally produce a stressed baseline (for example, the AWS m5.large catalog denominator is 2,000 RPS); for a healthy, capacity-bounded compute experiment, declare an explicit per-node capacity such as 500 RPS. That value is an experiment control, not a universal hardware fact. " +
      "For ECS/Fargate, set characteristics.perTaskCapacityRps independently on each service/resource; the configured desired and maximum task counts are multiplied by that resource's own rate. If you omit it, CWM's size-based heuristic is labeled an assumption, not a provider-published or measured rate. An explicit rate without evidence is also an unverified assumption. To assert documented or measured capacity, include characteristics.perTaskCapacityEvidence with basis='documented' or basis='measured' and a supporting source; a numeric rate alone is never labeled measured. normalizedConfig.requestServing and predictionEvidence.requestServingCapacity report each tier's rate, task counts, aggregates, and basis. " +
      "Owned AWS CRUD calibration eligibility is exact and intentionally narrow. The graph must contain exactly four healthy, routable AWS resources and exactly four edges: one internal ALB → each of two compute apps → one database, with no other nodes or edges. Each app must be m5.large; its absent serviceFamily is inferred as ec2 for eligibility only, explicit ec2 is accepted, and any other explicit family fails. The database must be db.r5.large; absent serviceFamily is inferred as rds for eligibility only, explicit rds is accepted, and any other explicit family fails. The database must declare MySQL workload identity using characteristics.workloadDatabaseEngine='mysql', or the literal characteristics.engine='mysql' alias on this exact database shape. The alias is accepted on that database shape even in an incomplete graph, but does not by itself make the graph fit-eligible. That engine alias is workload identity only: it does not declare an engine version, Extended Support, lifecycle, or billing option; those inputs remain rejected, and callers should prefer workloadDatabaseEngine. The sole network node must be identified by explicit serviceFamily='alb', or, only when serviceFamily is absent, by an unambiguous name containing 'ALB' or 'Application Load Balancer'; explicit network-service size/type discriminators must not indicate NLB or another service. A generic unnamed network node, explicit nlb, or contradictory discriminator is ambiguous and does not qualify. " +
      "Each app may explicitly set characteristics.workload='crud', or omit it only for this fully matched canonical graph with the MySQL identity above; this is a canonical CRUD modeling assumption, not evidence of the caller's real application behavior, and is identified in calibrationEvidence.note. Explicit conflicting workload values fail. No workload inference applies to similar-but-not-exact graphs, other instance types, providers, or incomplete graphs. Each app must have autoscaling disabled and fixed minInstances=maxInstances=2. Traffic must be within the inclusive 10–1,000 RPS range. The fit also requires no active failure and no failure, warmup, or snapshot metadata; no explicit app capacity override (capacityRps, requestsPerSecond, or non-default maxThroughput); and no non-default app baseLatency. If set, database maxConnections must be 500 and effectiveMaxConnections must be absent; if set, ALB maxThroughput must be 50,000. The us-east-2 / seed 20240601 result is the parity fixture, not a claim that other regions have been measured. " +
      "When the gate fails, calibrationEvidence.kind is modeled and calibrationEvidence.note identifies actual exclusions. Lean owned calibration requires explicit appWeight:'lean': aws-crud/v1:473f1339-f712-4096-96d6-3d4fc07cb427:7416cb63ace3a7ab2e3486bb6f132a2dcb574c34. Separately, the exact owned typical graph uses appWeight:'typical', resource.location.regionKey:'us-east-2' on ALL four nodes (normalized to use2), internal ALB characteristics.loadBalancerScheme:'internal', two m5.large apps each with workload:'crud-typical', appRuntime:'node', appWorkerCount:2, appDbPoolSize:250, and a db.r5.large MySQL with explicit maxConnections:500 and workloadDatabaseVersion:'8.0'. Set minInstances=maxInstances=2, autoscaling:false on apps, and traffic 20–300 RPS. Its calibrationId names typical-v1-20260927c and measurement 6aa574d7ff9d3080b88b221bcd59f7d218ae37f0; ONLY typical-fit-20, typical-fit-100, typical-fit-200 were fitting rungs. 300 RPS is an independent holdout, 500 RPS diagnostic only. Neither fit establishes measurements for arbitrary typical workloads; cost is list price, not a measured bill. Generic typical CPU/latency anchors remain placeholder guidance. Known-vCPU shapes use the workload model, never a validated cross-provider conversion. Lean proportional M5 scaling is 'scaled from measured'; its latency at offered application RPS T is P50=max(1.45, 2.4833-0.0010466*T) ms and P95=max(P50, 3.10, 4.3697-0.0012973*T) ms (full-precision fit); penalties follow the baseline, with no generic 5 ms floor (only a 0.05 ms physical safety floor). Other providers and generic typical/heavy are 'reference estimate'. predictionEvidence version 1 reports app CPU (not aggregate CPU), per-resource CPU and P50/P95 low/central/high, sourceIds/formulaIds, and loadScope. Intervals are assumptions, not confidence intervals; beyond 1000 offered RPS they widen and cannot be measured. Unknown-vCPU fallback retains unverified generic numbers with no external reference. No other hardware has been validated. " +
      "For generic fixed compute, characteristics.instanceCount accepts integer 1–100 represented VMs; capacity is aggregated and CPU is per VM. Do not combine it with autoscaling:true, minInstances, or maxInstances. Aurora Serverless v2 remains limited to 1 with multiAz:false or 2 with multiAz:true. For Aurora Serverless ACU limits, use characteristics.config.minCapacity/maxCapacity or flat characteristics.minCapacity/maxCapacity. The exact AWS database shape with serviceFamily: 'aurora-serverless' and size: 'db.serverless' also accepts flat characteristics.minAcu/maxAcu; those aliases are rejected elsewhere, including at the resource root or inside config. Its connection limit is fixed from maximum configured ACU (16 ACU and minimum 2 estimates 3360), unless characteristics.maxConnections is supplied. For that shape, multiAz:true with instanceCount:2 creates a separately billable reader (<writer-id>-reader) in another AZ. Inspect returned resources and metrics before using simulation.step or chaos.run to observe modeled failover; no AWS timing guarantee is implied. " +
      "For database connection budgets, set characteristics.connectionDemand on a database: {mode:'declared',declaredConnections:240} uses that plan-time demand without RPS; {mode:'max',declaredConnections:240,idlePoolFloor:200} takes the maximum of load-derived demand and the declared/floor values; omitted configuration preserves load-derived behavior. Separately, a compute resource with characteristics.appDbPoolSize and a direct database connection automatically contributes its maximum fleet count × pool size to metrics.databases[].declaredFleetConnectionBudget; declaredFleetConnectionBudgetTiers identifies each tier's count, pool size, and capacity basis. Autoscaled tiers use maxInstances (or the provider maximum), independent of current warm members or routed traffic; fixed tiers use instanceCount or declared fleet bounds. This is an ASSUMPTION / worst-case pool-holder budget, not observed DB sessions. loadDerivedConnections stays separately available as the traffic-derived estimate, and this automatic budget does not replace it or alter cost, DB CPU, or latency. " +
      "declaredConnections and idlePoolFloor are ASSUMPTIONS / plan-time budgets (for example, replicas × per-pod pool size), not observed live DB connections. Set maxConnections to the usable limit you intend to test. Per-database metrics report connectionDemandMode, loadDerivedConnections, declaredConnections/idlePoolFloor, and modeledConnections; cost and DB CPU/latency remain based on existing load-driven behavior. Demand above the usable limit adds a bounded, rule-based pool-saturation error signal; it is not a provider-calibrated rate. " +
      "A declared reader defaults to writer-mirror (Aurora promotion tiers 0/1, mirrored ACU and modeled CPU; not independently routed read work). Set characteristics.auroraReaderScalingMode to independent (tiers 2–15) for own routed load and ACU floor; set it on a two-instance writer to configure its derived reader. Inspect normalizedConfig.resources[].auroraReaderScalingMode and metrics.serverless[].scalingMode; use simulation.cost_breakdown for each separately billed ACU-hour and modeled parked-writer charge. " +
      "For OCI flexible compute shapes, pass the documented positive integer characteristics.ocpus explicitly; VM.Standard.E4.Flex accepts 1–64 OCPUs and each OCPU maps to 2 vCPUs. OCPU count establishes capacity dimensions only, not provider-specific performance, throughput, or price. An uncounted flexible shape remains an unverified generic estimate. Check GET /api/prediction/generic-shapes for the catalog-derived generic fallback inventory. " +
      "New prediction-only GCP standard capacity entries include e2-standard-2/4/8/16/32, n1-standard-1/2/4/8/16/32/64/96, and n2-standard-16/32/48/64/80/96/128; provider specifications establish vCPU/memory dimensions, not CWM performance or pricing. Version 1 predictionEvidence explicitly reports legacyGeneric at the top level and on every appCpuByResource item; its note identifies each generic resource's shape and fallback reason. " +
      "Any capacity, node-bound, SKU, or autoscaling value supplied through this tool is recorded as agent-supplied in the immutable normalizationReceipt; use responseMode: 'full' and inspect that receipt rather than describing an agent calibration as observed human input. Generic GKE telemetry and recovery apply only to worker nodes; its control-plane management fee is cost-only, and this tool does not model control-plane CPU, API throttling, or control-plane cooldown. " +
      "To bound the autoscaled fleet size, set the top-level maxInstances / minInstances parameters. If you do not set maxInstances, the engine uses the provider default — AWS 50, GCP 15, Azure/OCI/DigitalOcean 10 — which may be much larger than your intended fleet size (e.g. an 'ASG with max 6 nodes' would silently be allowed to grow toward 50 on AWS). The response includes effectiveMaxInstances / effectiveMinInstances so you can confirm the bounds that will be enforced. " +
      "For a targeted CPU HPA scale-out threshold, send the canonical autoscalingTargetCpu field in this create call (for example, autoscalingTargetCpu: 70 for GKE). The compatible aliases scaleOutCpuThreshold, scaleOutCpuPercent, and autoscaleTargetCpuPercent are also accepted; if more than one is sent, their values must agree. Every create response includes hpaAudit with the supplied field, persisted thresholds, and any provider default. " +
      "For an ECS Fargate CPU-only target-tracking fleet, set ecsCpuTargetTracking: true with autoscalingTargetCpu, minInstances/maxInstances, and optional scaleOutCooldownSeconds/scaleInCooldownSeconds (simulated seconds, defaulting to cooldownSeconds). simulationSecondsPerStep controls clock conversion (default 1). This disables latency/throughput scale-out for that ECS fleet; inspect autoscalingConfig and the resource's applicationAutoscalingPolicy in the full response. " +
      "These four TOP-LEVEL fields are simulation-wide — the engine applies one CPU threshold identically to every resource's scale decision by default. To make ONE resource scale at a different CPU target than the rest of the simulation (e.g. a GKE cluster scaling out at 60% while an EC2 fleet in the same simulation scales out at 80%), set characteristics.scaleOutCpuThreshold and/or characteristics.scaleInCpuThreshold on that specific resource instead — the per-resource value wins over the simulation-wide default for that resource only, and every other resource is unaffected. A misnamed near-miss field nested under characteristics (e.g. targetCPUUtilizationPercentage) is rejected with a 400 explaining the correct field name — it is never silently dropped and defaulted. " +
      "Responses are compact by default: id, name, status, traffic, and a per-resource summary (id, name, status, cpuPercent, routedRps, availabilityState, isRoutable, and recoveryBlockedReason when provided). Pass responseMode: 'full' to get the complete simulation object instead. During a failure workflow, lower traffic to serviceable levels before calling simulation.recover_resource, then use simulation.step until the recovered resource is healthy. " +
      "Recovery progress is included when applicable: recoveryProgress.state is parked, cooling_down, or healthy, and its parkWindow/cooldown objects report totalSteps, completedSteps, remainingSteps, target, and requiredSteps. Poll simulation.get or simulation.step until state is healthy. " +
      "No prerequisites beyond authentication. Returns the created simulation's id, consumed by every simulation-scoped tool. The likely next tool is simulation.step. " +
      "Do not call api.spec to learn the workflow — the tool descriptions in this session contain everything needed. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      name: z.string().describe("Human-readable name for the simulation"),
      appWeight: z.enum(["lean", "typical", "heavy"]).optional().describe("Immutable root-level workload weight. Omitted means typical (appWeightDefaulted=true); explicit typical predicts identical values. Lean selects the owned fit only for the eligible graph. predictionEvidence contains CPU/P50/P95 assumption ranges, not confidence intervals. Heavy is an unsupported product assumption."),
      description: z.string().optional().describe("Optional description of the simulation scenario"),
      scenarioId: z.string().min(1).optional().describe("Live scenario identifier from scenario.list; mutually exclusive with resources and connections"),
      scenarioOverrides: z
        .union([
          z.object({
            eksSpotInterruption: z.object({
              startupSeconds: z
                .number()
                .int()
                .min(0)
                .max(3600)
                .describe("Catalog EKS Spot startup duration in seconds (0–3600)"),
            }).strict(),
          }).strict(),
          z.object({
            webAutoscaling: z.object({
              includeTrafficRecovery: z.boolean().default(false).describe(
                "Activate the optional Web App Autoscaling Traffic Recovery ramp; defaults to false (inactive). Set true to observe scale-in, or false to leave it inactive.",
              ),
            }).strict(),
          }).strict(),
        ])
        .optional()
        .describe("Scenario-only customization; requires scenarioId and exactly one supported override. Web App Autoscaling recovery must be selected before the first simulation.step."),
      resources: z
        .array(
          z.object({
            id: z.string().describe("Unique identifier for this resource within the simulation"),
            type: z
              .enum(["compute", "database", "storage", "network", "cache", "queue", "kubernetes"])
              .describe("Resource category"),
            name: z.string().describe("Display name for the resource"),
            // Preserve output-only near-misses so HTTP intake can return
            // INVALID_FIELD instead of Zod silently stripping them.
            minAcu: z.unknown().optional().describe("Not accepted at resource level; use characteristics.minAcu for the exact AWS Aurora Serverless v2 db.serverless shape."),
            maxAcu: z.unknown().optional().describe("Not accepted at resource level; use characteristics.maxAcu for the exact AWS Aurora Serverless v2 db.serverless shape."),
            provider: z
              .enum(["aws", "gcp", "azure", "oci", "digitalocean"])
              .default("aws")
              .describe("Cloud provider"),
            location: z.object({ regionKey: z.string(), zoneKey: z.string().optional(), localityType: z.enum(["az", "zone", "availability_domain", "fault_domain"]).optional(), providerLabel: z.string().optional(), faultDomainKey: z.string().optional() }).optional().describe("Resource location. Set regionKey:'us-east-2' on all four owned typical nodes; REST normalizes it to the AWS catalog key use2. Do not put region under characteristics."),
            recoveryPolicy: z
              .object({
                criticalCpuThreshold: z.number().min(0).max(100).optional(),
                criticalSteps: z.number().int().min(1).optional(),
                warningCpuThreshold: z.number().min(0).max(100).optional(),
                warningSteps: z.number().int().min(1).optional(),
                failureParkSteps: z.number().int().min(1).optional(),
              })
              .optional()
              .describe("Optional recovery thresholds and cooldown lengths for this resource"),
            characteristics: z
              .object({
                size: z.string().optional().describe("Instance/resource size, e.g. t3.medium, n1-standard-2"),
                ocpus: z.number().int().positive().max(126).optional().describe("OCI flexible compute shape capacity. Family-specific limits are validated against the provider shape; VM.Standard.E4.Flex accepts 1–64 OCPUs and 1 OCPU = 2 vCPUs. Not a performance or price claim."),
                workload: z.enum(["crud", "crud-typical"]).optional().describe("Set 'crud' for the lean owned graph or 'crud-typical' for the exact owned typical Node graph. Omission can qualify for lean only on the complete canonical graph; typical requires explicit identity."),
                appRuntime: z.string().optional().describe("Owned typical: 'node' on both apps."),
                appWorkerCount: z.number().int().positive().optional().describe("Owned typical: 2 on each app."),
                appDbPoolSize: z.number().int().positive().optional().describe("Owned typical: 250 on each app."),
                workloadDatabaseVersion: z.string().optional().describe("Owned typical: '8.0' on the MySQL database; workload identity only, not RDS lifecycle billing."),
                loadBalancerScheme: z.enum(["internal", "internet-facing"]).optional().describe("Owned typical: 'internal' on the ALB."),
                workloadDatabaseEngine: z.enum(["mysql"]).optional().describe("Preferred MySQL workload identity for the exact healthy AWS db.r5.large RDS node in the owned CRUD graph. Literal characteristics.engine='mysql' is a narrow workload-only alias for this exact shape; it does not enable engine-version, Extended Support, lifecycle, or billing inputs, which remain rejected."),
                engine: z.string().optional().describe("AWS RDS direct engine field is accepted only as literal 'mysql' workload identity on the exact db.r5.large canonical owned-CRUD database; prefer workloadDatabaseEngine. It does not declare engine version, Extended Support, lifecycle, or billing behavior; other engine values and lifecycle/billing fields remain rejected."),
                capacityRps: z
                  .number()
                  .positive()
                  .optional()
                  .describe("Compute only: literal per-node RPS ceiling at which CPU reaches ~95%. Kubernetes rejects capacityRps; use maxThroughput for its total cluster ceiling."),
                maxThroughput: z
                  .number()
                  .optional()
                  .describe("Kubernetes: total cluster RPS ceiling; compute: legacy internal throughput scaling parameter (prefer capacityRps for compute)."),
                maxConnections: z.number().int().positive().max(1_000_000).optional().describe("Fixed concurrent DB connection budget; Aurora Serverless defaults from maximum configured ACU."),
                cdnTraffic: cdnTrafficSchema.optional().describe("Assumed CDN cacheable/dynamic request mix and DB-query fractions. cacheHitRate applies only to the cacheable share. Read simulation.step metrics.cdnFlow for the modeled edge, origin and database flow."),
                cacheHitRate: z.number().min(0).max(1).optional(),
                sessionAffinity: sessionAffinitySchema.optional().describe("Opt-in modeled sticky owners for generic compute; Kubernetes requires explicit workload replicas independent of nodes. Use identical fleetId/config on compute peers. Existing sessions do not migrate on scale-out; owner loss disconnects them. reconnect:'next-step' explicitly enables rebinding; default none. Session arrivals/lifetime are assumptions, not measured OpenShell data. Read full step metrics.sessionAffinity for per-owner load, rejects and disconnects."),
                 connectionDemand: z.object({
                   mode: z.enum(["load-derived", "declared", "max"]).describe("load-derived keeps the legacy traffic estimate; declared uses only the plan-time declaredConnections/idlePoolFloor; max uses the greatest of load-derived and declared/floor demand."),
                   declaredConnections: z.number().int().min(0).max(1_000_000).optional().describe("ASSUMPTION / plan-time peak pool budget (for example, replicas × per-pod pool size), not an observed live connection count."),
                   idlePoolFloor: z.number().int().min(0).max(1_000_000).optional().describe("ASSUMPTION / plan-time minimum idle pool footprint, not an observed live connection count."),
                 }).optional().describe("Database only. Omit to preserve legacy load-derived connection use. `declared` and `max` require declaredConnections and/or idlePoolFloor. Demand above usable maxConnections adds a bounded rule-based pool-saturation error signal, not a provider-calibrated rate."),
                minCapacity: z.number().positive().optional().describe("Aurora Serverless minimum ACU (flat form; nested config wins)."),
                maxCapacity: z.number().positive().optional().describe("Aurora Serverless maximum ACU (flat form; nested config wins)."),
                minAcu: z.number().positive().optional().describe("Flat minimum ACU alias only for AWS Aurora Serverless v2 size db.serverless; conflicts with minCapacity are rejected."),
                maxAcu: z.number().positive().optional().describe("Flat maximum ACU alias only for AWS Aurora Serverless v2 size db.serverless; conflicts with maxCapacity are rejected."),
                config: z.object({
                  minCapacity: z.number().positive().optional(),
                  maxCapacity: z.number().positive().optional(),
                }).passthrough().optional().describe("Aurora Serverless ACU bounds. Nested config uses minCapacity/maxCapacity; flat characteristics.minAcu/maxAcu aliases are accepted only on the exact AWS Aurora Serverless v2 db.serverless shape."),
                auroraStandbyResourceId: z.string().min(1).optional().describe("AWS Aurora writer only: ID of a distinct healthy Aurora standby for opt-in modeled quick-failure promotion; no AWS calls."),
                auroraReaderScalingMode: z.enum(["writer-mirror", "independent"]).optional().describe("Aurora Serverless v2 reader: writer-mirror (default, promotion tier 0/1) follows writer ACU; independent (tier 2–15) uses routed reader load and ACU floor. Each instance incurs its own ACU-hour charge. Set on a declared reader, or writer when generating a multiAz two-instance reader."),
                multiAz: z.boolean().optional().describe("AWS Aurora Serverless v2: true with instanceCount:2 creates a billable reader in a second AZ."),
                instanceCount: z.number().int().min(1).max(100).optional().describe("Generic fixed compute: represented VM count (integer 1–100); capacity aggregates and CPU is per VM. Cannot combine with autoscaling:true, minInstances, or maxInstances. AWS Aurora Serverless v2 remains 1 with multiAz:false or 2 with multiAz:true."),
                autoscaling: z.boolean().optional().describe("Whether autoscaling is enabled for this resource"),
                billingState: z
                  .enum(["active", "idle", "stopped", "detached", "deleted"])
                  .optional()
                  .describe("Billing state: 'stopped' bills storage only, 'idle'/'detached' bill flat idle rates, 'deleted' bills nothing. Default 'active'."),
                serviceFamily: z
                  .string()
                  .optional()
                  .describe("Service family discriminator. For owned AWS CRUD eligibility only, absent ec2/rds may be inferred for exact m5.large/db.r5.large shapes; explicit ec2/rds is accepted, conflicting families fail. The sole ALB may use explicit 'alb'; absent family requires an unambiguous ALB resource name. These inferences do not rewrite persisted caller configuration. Idle-billed families include nat-gateway, vpc-endpoint, eip-detached, ebs-snapshot, cloud-nat, and private-endpoint."),
                capacityGB: z
                  .number()
                  .optional()
                  .describe("Storage capacity in GB — drives per-GB snapshot/backup idle cost and stopped-instance storage cost"),
                scaleOutCpuThreshold: z
                  .number()
                  .min(0)
                  .max(100)
                  .optional()
                  .describe("Compute or Kubernetes only — overrides the simulation-wide CPU HPA scale-out target (see the top-level autoscalingTargetCpu) for THIS resource's scale decisions only; every other resource keeps the simulation-wide default."),
                scaleInCpuThreshold: z
                  .number()
                  .min(0)
                  .max(100)
                  .optional()
                  .describe("Compute or Kubernetes only — overrides the simulation-wide CPU HPA scale-in target for THIS resource's scale decisions only; every other resource keeps the simulation-wide default."),
                kubernetesCpuHpa: kubernetesCpuHpaSchema.optional().describe(
                  "Opt-in bounded workload-pod replica model, separate from node-pool scaling. Declare CPU demand in millicores/RPS and targets (Utilization requires an explicit CPU request). A reviewed cpuDemandCalibration may include 2–100 offered-RPS/aggregate-mCPU points and must match the explicit demand value; cite its source and reference in cpuDemandEvidence. Unannotated request/demand inputs are ASSUMED; no HPA controller parity is claimed.",
                ),
              })
              .passthrough()
              .optional()
              .describe("Provider-specific resource characteristics (extra keys such as costMultiplier pass through unchanged)"),
          })
        )
        .optional()
        .describe(`${SCENARIO_RESOURCES_INPUT_DESCRIPTION} Mutually exclusive with scenarioId.`),
      connections: z
        .array(
          z.object({
            sourceId: z.string().describe("ID of the source (upstream) resource"),
            targetId: z.string().describe("ID of the target (downstream) resource"),
            label: z.string().optional().describe("Optional label describing the connection type"),
          })
        )
        .optional()
        .describe(`${SCENARIO_CONNECTIONS_INPUT_DESCRIPTION} (e.g. web server → database). Omit when using scenarioId.`),
      traffic: z.number().optional().describe("Initial traffic level in requests per second (defaults to 0 for explicit resource graphs; scenarioId uses the catalog's step-zero traffic when omitted)"),
      seed: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Deterministic RNG seed. Reuse the same seed, traffic, topology, and fault schedule for reproducible incident replays."),
      maxInstances: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Hard ceiling on the autoscaled compute fleet size, stored as autoscalingConfig.maxInstances and enforced by the engine's autoscale cap logic. If omitted, the provider default applies (AWS 50, GCP 15, Azure/OCI/DigitalOcean 10) — which may be much larger than your intended fleet size."),
      minInstances: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Floor on the autoscaled compute fleet size, stored as autoscalingConfig.minInstances. If omitted, the provider default applies (AWS/GCP/Azure/OCI 2, DigitalOcean 1)."),
      autoscalingTargetCpu: z.number().min(0).max(100).optional().describe("Canonical CPU HPA scale-out target percent. CWM synthesizes unrelated autoscaling defaults."),
      scaleOutCpuThreshold: z.number().min(0).max(100).optional().describe("Equivalent alias for autoscalingTargetCpu; if both are sent they must match."),
      scaleOutCpuPercent: z.number().min(0).max(100).optional().describe("Grok-compatible alias for the CPU HPA scale-out target; if multiple target names are sent they must match."),
      autoscaleTargetCpuPercent: z.number().min(0).max(100).optional().describe("Grok-compatible alias for the CPU HPA scale-out target; if multiple target names are sent they must match."),
      ecsCpuTargetTracking: z.boolean().optional().describe("Opt into CPU-only ECS Fargate target tracking; other providers keep their existing scaling policy."),
      scaleOutCooldownSeconds: z.number().int().min(0).max(86400).optional().describe("ECS CPU target-tracking scale-out cooldown in simulated seconds."),
      scaleInCooldownSeconds: z.number().int().min(0).max(86400).optional().describe("ECS CPU target-tracking scale-in cooldown in simulated seconds."),
      simulationSecondsPerStep: z.number().positive().max(60).optional().describe("Simulated seconds per step for ECS cooldowns (default 1)."),
      resilienceConfig: mcpResilienceConfigSchema
        .optional()
        .describe(
          "Optional retry/cascade resilience model. When set, the step engine models retry amplification, circuit-breaker state, rate limiting, and cascading-failure depth across the declared dependencies. " +
          "resilienceConfig.externalMetrics accepts deterministic sampled metrics for independent triggers. no_ready_endpoints is a successful zero only when that trigger opts in with noReadyEndpointsAsZero:true; discovery_error and fetch_error always remain errors. This is a recommendation model, not a KEDA/provider actuator, and does not change resource counts. " +
          "Goodput and errorRate are client-level outcomes against original offered RPS. A dependency targeting an autoscaled compute member uses aggregate capacity and health from its routable fleet; a non-autoscaled target uses its resolved resource capacity (including any declared fixed-instance count) once. retryAmplificationFactor is (original offered RPS + generated retry RPS) / original offered RPS, not a capacity measure. " +
          "Set per-edge policy at resilienceConfig.dependencies[].retryPolicy, e.g. {id:'web-to-db',sourceId:'web-1',targetId:'db-1',retryPolicy:{timeoutMs:10000,maxRetries:0}}. " +
          "Also supported there: backoffMs, backoffMultiplier, jitterRatio, retryBudgetRatio, retryBudgetRps, and retryActorId. Omitted fields use maxRetries:2 and timeoutMs:2000; compact create responses return the effective resilienceConfig. " +
          "Each step response then includes retryAmplificationFactor (headline metric) and a full resilience telemetry block. " +
          "Omit entirely to leave the resilience model disabled (byte-identical to existing behavior)."
        ),
      responseMode: z
        .enum(["compact", "full"])
        .default("compact")
        .describe(CREATE_RESPONSE_MODE_DESCRIBE),
    },
    outputSchema: createOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (args) => {
    try {
      const { responseMode, ...createArgs } = args;
      const hasResources = createArgs.resources !== undefined;
      const hasScenarioId = createArgs.scenarioId !== undefined;
      const hasScenarioOverrides = createArgs.scenarioOverrides !== undefined;
      if (!hasResources && !hasScenarioId) {
        return errorResult("Provide either resources or scenarioId to create a simulation.");
      }
      if (hasScenarioOverrides && !hasScenarioId) {
        return errorResult("scenarioOverrides requires scenarioId and cannot be used with an explicit resource graph.");
      }
      if (hasResources && hasScenarioId) {
        return errorResult("Do not provide scenarioId with resources or connections; choose one graph source.");
      }
      const result = await ctx.apiCall(
        "POST",
        "/api/simulations",
        {
          ...createArgs,
          ...(hasScenarioId ? {} : { connections: createArgs.connections ?? [] }),
        },
        true
      );
      if (responseMode === "full") return structuredResult(result);
      return structuredResult(toCompactCreateResponse(result));
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.update",
  {
    title: "Update Simulation",
    description:
      "Update an existing simulation's autoscaling fleet bounds, CPU HPA target, resilience config, or complete resource list. " +
      "resilienceConfig.externalMetrics is a deterministic sampled recommendation model: no_ready_endpoints is successful zero only when its trigger sets noReadyEndpointsAsZero:true; discovery_error and fetch_error always remain errors. It is not a KEDA/provider actuator and does not change resource counts. " +
      "Use it to adjust maxInstances / minInstances after creation — e.g. to tighten a fleet ceiling before a surge experiment — or to attach/replace a resilienceConfig to enable retry amplification modeling. " +
      "Set per-edge retry behavior inside resilienceConfig.dependencies[].retryPolicy, e.g. {id:'web-to-db',sourceId:'web-1',targetId:'db-1',retryPolicy:{timeoutMs:10000,maxRetries:0}}. " +
      "backoffMs, backoffMultiplier, jitterRatio, retryBudgetRatio, retryBudgetRps, and retryActorId are also supported there; omitted fields keep the defaults (2 retries, 2000 ms timeout). " +
      "The response includes the effective resilienceConfig. PATCH replaces the resilience model, so include the complete config you want retained. " +
      "To set only the CPU HPA scale-out target while preserving provider defaults for all other autoscaling fields, send one of autoscalingTargetCpu, scaleOutCpuThreshold, scaleOutCpuPercent, or autoscaleTargetCpuPercent. If multiple target names are sent, their values must agree. These fields are simulation-wide and only recognized at the top level of this call — a misnamed CPU target field is rejected with a 400, not silently dropped and defaulted. To change per-resource characteristics such as connectionDemand, pass the complete updated resources array; it replaces the stored resource list, so preserve all existing resource fields and connections. " +
      "Set resources and connections before the first simulation.step: once the first step finalizes replay identity, updates that include either field return 409 and topology cannot be edited. This replay protection cannot be bypassed. For sticky Kubernetes workloads, configure characteristics.sessionAffinity.workload.replicas and its CPU-driven autoscaling before stepping; this is modeled workload behavior, not a manual in-run scaling command. " +
      "If a simulation was created without maxInstances, the engine enforces the provider default cap — AWS 50, GCP 15, Azure/OCI/DigitalOcean 10 — which may be much larger than your intended fleet size. " +
      "The response includes effectiveMaxInstances / effectiveMinInstances so you can confirm the bounds that will be enforced. " +
      "Do not use it to change traffic (use simulation.inject_traffic) or resource sizes (use simulation.resize). " +
      "Requires a simulationId from simulation.create or simulation.list. The likely next tool is simulation.step to observe the updated bounds, or simulation.compare_resilience to quantify a resilience improvement. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      simulationId: z
        .string()
        .describe("ID of the simulation to update. Required — obtain it from simulation.create or simulation.list."),
      maxInstances: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("New hard ceiling on the autoscaled compute fleet size, stored as autoscalingConfig.maxInstances and enforced by the engine's autoscale cap logic."),
      minInstances: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("New floor on the autoscaled compute fleet size, stored as autoscalingConfig.minInstances."),
      autoscalingTargetCpu: z.number().min(0).max(100).optional().describe("Canonical CPU HPA scale-out target percent. Unrelated provider autoscaling defaults are preserved."),
      scaleOutCpuThreshold: z.number().min(0).max(100).optional().describe("Equivalent alias for autoscalingTargetCpu; if both are sent they must match."),
      scaleOutCpuPercent: z.number().min(0).max(100).optional().describe("Grok-compatible alias for the CPU HPA scale-out target; if multiple target names are sent they must match."),
      autoscaleTargetCpuPercent: z.number().min(0).max(100).optional().describe("Grok-compatible alias for the CPU HPA scale-out target; if multiple target names are sent they must match."),
      resources: z.array(z.object({
        characteristics: z.object({
          kubernetesCpuHpa: kubernetesCpuHpaSchema.optional().describe(
            "Opt-in per-workload replica recommendations from explicit CPU request, demand, and Utilization/AverageValue targets. A reviewed cpuDemandCalibration can derive demand from 2–100 CPU/RPS measurements; cite the source and reference in cpuDemandEvidence. This bounded model does not change node pools or claim controller parity.",
          ),
        }).passthrough().optional(),
      }).passthrough()).max(256).optional()
        .describe("Complete replacement resource list. Preserve existing IDs and topology. Use database characteristics.connectionDemand with load-derived, declared, or max mode; declaredConnections and idlePoolFloor are ASSUMPTIONS / plan-time budgets, not live connections. Demand above usable maxConnections adds a bounded rule-based pool-saturation error signal, not a provider-calibrated rate."),
      resilienceConfig: mcpResilienceConfigSchema
        .optional()
        .describe("Replace the simulation's resilience model using the same full resilienceConfig schema as simulation.create. Per-edge retry settings belong in dependencies[].retryPolicy. externalMetrics supports deterministic sampled triggers: no_ready_endpoints is successful zero only with noReadyEndpointsAsZero:true; discovery_error and fetch_error remain errors. It is a recommendation model, not a KEDA/provider actuator, and does not change resource counts."),
    },
    outputSchema: z
      .object({
        id: z.string().optional().describe("Simulation ID"),
        name: z.string().optional().describe("Simulation name"),
        effectiveMaxInstances: z.number().optional().describe("The fleet-size ceiling the engine will enforce after this update"),
        effectiveMinInstances: z.number().optional().describe("The fleet-size floor the engine will enforce after this update"),
        resilienceConfig: mcpResilienceConfigSchema.optional().describe("Effective resilience configuration after server defaults are applied"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      if (
        args.maxInstances === undefined &&
        args.minInstances === undefined &&
        args.resilienceConfig === undefined &&
        args.autoscalingTargetCpu === undefined &&
        args.scaleOutCpuThreshold === undefined &&
        args.scaleOutCpuPercent === undefined &&
        args.autoscaleTargetCpuPercent === undefined &&
        args.resources === undefined
      ) {
        return errorResult("Provide autoscaling bounds, a CPU HPA target, resources, or resilienceConfig to update.");
      }
      const body: Record<string, unknown> = {};
      if (args.maxInstances !== undefined) body.maxInstances = args.maxInstances;
      if (args.minInstances !== undefined) body.minInstances = args.minInstances;
      if (args.resilienceConfig !== undefined) body.resilienceConfig = args.resilienceConfig;
      if (args.autoscalingTargetCpu !== undefined) body.autoscalingTargetCpu = args.autoscalingTargetCpu;
      if (args.scaleOutCpuThreshold !== undefined) body.scaleOutCpuThreshold = args.scaleOutCpuThreshold;
      if (args.scaleOutCpuPercent !== undefined) body.scaleOutCpuPercent = args.scaleOutCpuPercent;
      if (args.autoscaleTargetCpuPercent !== undefined) body.autoscaleTargetCpuPercent = args.autoscaleTargetCpuPercent;
      if (args.resources !== undefined) body.resources = args.resources;
      const result = await ctx.apiCall("PATCH", `/api/simulations/${args.simulationId}`, body, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.step",
  {
    title: "Simulate Step",
    description:
      "Advance a simulation by one time step and return updated metrics (CPU, latency, throughput, error rate, cost). " +
      "Concurrent simulation.step calls on one simulation either serialize as distinct consecutive steps or receive HTTP 409 simulation_step_in_progress without advancing or consuming a demo credit. Wait for the running call to finish, then retry only rejected calls; steps for different simulations can run concurrently. A timeout is not an idempotency key: inspect simulation.metrics or simulation.get before retrying an uncertain result. " +
      "Use it to drive the simulation forward and observe system behaviour over time, typically right after simulation.create or a traffic/failure change. " +
      "Do not use it to read current state without advancing time — that is simulation.metrics. " +
      "With Aurora Serverless v2, responseMode:'full' includes metrics.serverless[] instanceRole, scalingMode, cpuBasis, acu, ratePerAcuHour, rateBasis and billingReason. A mirrored reader's CPU is modeled, not evidence of separately routed reads. For current per-instance spend, call simulation.cost_breakdown after stepping. " +
      "Responses are compact by default: principal metrics plus per-resource status (id, name, status, cpuPercent, routedRps, availabilityState, isRoutable, and recoveryBlockedReason when provided) and this step's events. Seeded characteristics.eksSpotInterruption telemetry retains its additive migrationEvaluation beside the interruption lifecycle: use its recorded/derived/unavailable field provenance, frozen deadline verdict/counts/reasons, and simulation-clock milestones rather than final service health. The distinct eksSpotMigration contract remains separately reported when configured. Compact responses also include errorBreakdown when the engine provides it. A critical resource with isRoutable: true is degraded but still serving; unavailable identifies a failed or parked node, while scaled_to_zero and cold_start identify Fargate no-task states. Pass responseMode: 'full' to get the complete simulation state instead. " +
      "During recovery, each resource may include recoveryProgress with state parked, cooling_down, or healthy, plus parkWindow and cooldown counters. Poll simulation.step or simulation.get and stop when the targeted resource's recoveryProgress.state is healthy. " +
      "GPU / inference workflow: when the simulation includes a kubernetes resource with characteristics.inferenceMode: true, each step response also includes gpuUtilization (%), tokensPerSecond, costPerMillionTokens (USD/M tokens), idleGpuCostPerHour (USD/hr of standby GPU spend), and idleGpuFraction (0-1 share of the GPU bill that is idle HA overhead). " +
      "costPerMillionTokens rises non-linearly as gpuUtilization falls — use it to track inference economics step by step. After sustained steps, fetch GPU right-sizing hints via GET /api/simulations/{id}/right-sizing-hint to get gpu-underutilized, gpu-saturated, or gpu-api-breakeven recommendations. " +
      "Requires a simulationId from simulation.create (or simulation.list). The likely next tool is simulation.step again, simulation.inject_traffic to change load, or simulation.metrics to review history. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      simulationId: z
        .string()
        .describe("ID of the simulation to step. Required — obtain it from simulation.create or simulation.list; authenticated tools have no session default."),
      traffic: z
        .number()
        .min(0)
        .optional()
        .describe("Optional traffic override in RPS for this step. Omit to use the simulation's current traffic."),
      responseMode: z
        .enum(["compact", "full"])
        .default("compact")
        .describe(RESPONSE_MODE_DESCRIBE),
    },
    outputSchema: stepOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = {};
      if (args.traffic !== undefined) body.traffic = args.traffic;
      const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/step`, body, true);
      const response = args.responseMode === "full" ? result : toCompactStepResponse(result);
      return stepResponseResult(response, () =>
        ctx.apiCall("GET", `/api/simulations/${args.simulationId}`, undefined, true));
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.metrics",
  {
    title: "Get Simulation Metrics",
    description:
      "Read the latest metrics and resource states for an existing simulation. Returns latency (P50/P95/P99), CPU usage, memory, throughput, error rate, cost per hour, and per-resource health. For P99, use latencyP99Basis for its percentile-specific basis and predictionEvidence.latencyP99 for evidenceLevel plus low/central/high assumption bounds when present. Values are prediction provenance, not observed simulated output; intervals are not statistical confidence intervals. Historical rows may omit P99 evidence. " +
      "Top-level effectiveConfigHash versions replay startup inputs with engineVersion and calibration identity; replayIdentity.effectiveConfigHash remains the original replay-only hash. " +
      "Use it to inspect current state and metrics history without advancing time; do not use it to move the simulation forward — that is simulation.step. " +
      "Responses are compact by default: principal current metrics plus explicit modeled goodputRps (a post-step point rate sourced from throughput, with provenance), goodputWindow (recorded only from persisted simulation-clock bounds, otherwise unavailable with provenance; never derive it from retrieval time or currentStep), errorBreakdown when available, per-resource status (id, name, status, cpuPercent, routedRps, availabilityState, isRoutable, and recoveryBlockedReason when provided), seeded EKS Spot checkpoint history and migrationEvaluationComplete/provenance when present, and the last " +
      `${METRICS_HISTORY_TAIL} metrics-history entries. Pass responseMode: 'full' to get the complete simulation object and full metrics history instead. ` +
      "When a DB-connected compute tier declares characteristics.appDbPoolSize, compact databaseConnectionDemand and full metrics.databases entries include the separate declaredFleetConnectionBudget plus tier-level max-count provenance; it is a plan-time worst case, not observed DB sessions. loadDerivedConnections and its estimate basis remain distinct. " +
      "During recovery, each resource may include recoveryProgress.state (parked, cooling_down, or healthy) with parkWindow and cooldown counters; poll simulation.metrics or simulation.get until healthy. " +
      "Aurora Serverless v2 metrics.serverless[] identifies the instance role, reader mode, CPU basis, billable ACU, per-ACU-hour rate and modeled allocated-writer billing during quick failure; use simulation.cost_breakdown for an exact per-resource cost sum. " +
      "GPU / inference workflow: when the simulation includes a kubernetes resource with characteristics.inferenceMode: true, the response also includes top-level gpuUtilization (%), tokensPerSecond, costPerMillionTokens (USD/M tokens), idleGpuCostPerHour (USD/hr of standby GPU spend), and idleGpuFraction (0-1 idle HA overhead share) from the latest step, and each history entry carries the same inference fields. " +
      "Use costPerMillionTokens to evaluate self-hosted inference economics — after 3+ steps you can call GET /api/simulations/{id}/right-sizing-hint to get gpu-underutilized, gpu-saturated, or gpu-api-breakeven right-sizing recommendations. " +
      "Requires a simulationId from simulation.create or simulation.list, and at least one simulation.step for meaningful metrics. " +
      "Read-only and does not advance time; repeated calls may consume credits according to the call type's listed price. The likely next tool is simulation.step or simulation.inject_traffic. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      simulationId: z
        .string()
        .describe("ID of the simulation to query. Required — obtain it from simulation.create or simulation.list; authenticated tools have no session default."),
      responseMode: z
        .enum(["compact", "full"])
        .default("compact")
        .describe(METRICS_RESPONSE_MODE_DESCRIBE),
    },
    outputSchema: metricsOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const [simulation, rawMetrics] = await Promise.all([
        ctx.apiCall("GET", `/api/simulations/${args.simulationId}`, undefined, true),
        ctx.apiCall("GET", `/api/simulations/${args.simulationId}/metrics`, undefined, true),
      ]);
      const { metrics, lastCostPerHour } = unwrapMetricsResponse(rawMetrics);
      if (args.responseMode === "full") {
        return structuredResult({
          ...toCompactMetricsResponse(simulation, metrics, lastCostPerHour),
          simulation,
          goodputWindow: goodputWindowFromPersistedMetrics(
            args.simulationId,
            metrics,
          ),
          metrics: metrics.map((entry) =>
            entry !== null && typeof entry === "object"
              ? addMcpGoodputContract(entry as Record<string, unknown>)
              : entry
          ),
          ...(lastCostPerHour !== undefined ? { lastCostPerHour } : {}),
        });
      }
      return structuredResult(toCompactMetricsResponse(simulation, metrics, lastCostPerHour));
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        return structuredResult({
          status: "not_found",
          message:
            "Simulation not found or has expired. Call simulation.create to start a new one, or simulation.list to view your active simulations.",
        });
      }
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.cost_breakdown",
  {
    title: "Get Per-Resource Cost Breakdown",
    description:
      "Return the latest per-resource hourly cost array for a simulation, joined with each resource's current status (healthy / warning / critical / stopped). " +
      "Use this after a failure or traffic surge to identify which resources continue billing while degraded ('zombie' or 'residual' infrastructure) — " +
      "e.g. assert 'NAT Gateway: $0.045/hr, RDS: $0.29/hr, 15× EC2 idle nodes: $0.096/hr each = $1.44/hr — total residual $1.77/hr' resource by resource instead of narrating aggregate cost jumps. " +
      "The response is always a flat array from the most recent metrics record — no paging, no metrics history — so it is cheap to call between every scenario step. " +
      "totalCostPerHour equals the exact sum of all resources[].costPerHour values. " +
      "Aurora Serverless v2 rows include instanceRole, scalingMode, billableAcu, ratePerAcuHour, rateBasis and billingReason. A default promotion-tier 0/1 reader mirrors the writer's modeled capacity/CPU but does not receive writer read traffic without routing; tier 2–15 independent readers use their own routed load/floor. Each instance bills its own ACU-hours. A quick-failure writer retains its frozen pre-failure allocated ACU as an explicit modeling assumption; it is unavailable, not a stopped cluster. " +
      "Do not use it to read full metrics history (that is simulation.metrics) or to advance time (that is simulation.step). " +
      "Requires a simulationId from simulation.create or simulation.list, and at least one simulation.step (404 not_ready until the first step). " +
      "Read-only; repeated calls may consume credits according to the call type's listed price. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      simulationId: z
        .string()
        .describe("ID of the simulation to query. Required — obtain it from simulation.create or simulation.list; authenticated tools have no session default."),
    },
    outputSchema: z
      .object({
        simulationId: z.string().optional().describe("Simulation ID"),
        stepIndex: z.number().optional().describe("Simulation step the breakdown was computed at"),
        totalCostPerHour: z.number().optional().describe("Exact sum of all resources[].costPerHour values (USD/hr)"),
        residualCostPerHour: z.number().optional().describe("Subtotal of unavailable, parked, or stopped resource costs; healthy/degraded idle resources including ALBs are excluded."),
        resources: z
          .array(
            z.object({
              resourceId: z.string(),
              name: z.string(),
              resourceType: z.string(),
              provider: z.string(),
              costPerHour: z.number(),
              status: z.string().describe("Current resource status: healthy, warning, critical, stopped, or removed"),
            }).passthrough()
          )
          .optional()
          .describe("Per-resource hourly cost entries from the latest metrics record"),
        status: z.string().optional().describe("Set on not_found / not_ready responses"),
        message: z.string().optional(),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/simulations/${args.simulationId}/cost-breakdown`, undefined, true);
      return structuredResult(result);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        return structuredResult({
          status: "not_found",
          message:
            "Simulation not found/expired, or it has not been stepped yet (cost breakdowns are computed on every step). " +
            "Call simulation.step at least once, or simulation.list to view your active simulations.",
        });
      }
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.list",
  {
    title: "List Simulations",
    description:
      "List all simulations owned by the current API key. Returns simulation IDs, names, resource counts, and status. Use the returned IDs with simulation.step, simulation.metrics, rl.create, chaos.run, or multicloud.explore. " +
      "Responses are compact by default: id, name, status, and resourceCount per simulation. Pass responseMode: 'full' to get the complete simulation objects instead. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      responseMode: z
        .enum(["compact", "full"])
        .default("compact")
        .describe(LIST_RESPONSE_MODE_DESCRIBE),
    },
    outputSchema: listOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", "/api/simulations", undefined, true);
      const items = Array.isArray(result) ? result : [result];
      if (args.responseMode === "full") return arrayResult(items, "simulations");
      return arrayResult(toCompactListItems(items), "simulations");
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.get",
  {
    title: "Get Simulation",
    description:
      "Fetch the current state of a simulation including its normalizedConfig — the engine-resolved billing parameters " +
      "(cost multipliers, hourly rates, autoscale thresholds, GPU SKU, per-node token throughput, billing floors, connection limits) " +
      "that show exactly what CWM is modelling. " +
      "Use it to verify a simulation was configured as intended — e.g. confirm which GPU SKU was resolved, " +
      "the effective autoscale CPU threshold, or the billing floor node count — without advancing time. " +
      "For GPU inference clusters, normalizedConfig.resources[].behaviorModel exposes two distinct topology model components: " +
      "(1) throughput scaling — topologyThroughputFactor (resolveTopologyScalingFactor) is the coefficient applied to token capacity " +
      "(nodes × perNodeTokensPerSec × factor × gpuUtil/100); topologyIsLegacyBaseline=true when intraNode was absent/unrecognised " +
      "(factor 1.0, pre-topology assumption, not a fabric measurement); topologyThroughputCalibrationStatus qualifies the factor. " +
      "(2) latency shape — topologyTtftFactor + topologyDecodeFactor (resolveTopologyLatencyFactors) scale TTFT and decode curves; " +
      "topologyCalibrationStatus qualifies those latency factors. " +
      "Do not use it to step the simulation forward (use simulation.step) or read metrics history (use simulation.metrics). " +
        "Compact mode (default) returns id, name, status, traffic, prediction/replay identity metadata, " +
        "effectiveMaxInstances, effectiveMinInstances, a per-resource status summary, and normalizedConfig. " +
        "Pass responseMode: 'full' to get the complete simulation object. " +
      "Requires a simulationId from simulation.create or simulation.list. " +
      "Returns no identifiers consumed by other tools — read-only, but repeated calls may consume credits according to the call type's listed price. " +
      "The likely next tool is simulation.step or simulation.metrics. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      simulationId: z
        .string()
        .describe("ID of the simulation to fetch. Required — obtain it from simulation.create or simulation.list."),
      responseMode: z
        .enum(["compact", "full"])
        .default("compact")
        .describe(
          "Response detail level. 'compact' (default) returns id, name, status, traffic, prediction/replay identity metadata, " +
          "effectiveMaxInstances, effectiveMinInstances, a per-resource status summary (id, name, status, cpuPercent), and normalizedConfig. " +
          "'full' returns the complete simulation object including all resource characteristics and connections."
        ),
    },
    outputSchema: z
      .object({
        id: z.string().optional().describe("Simulation ID"),
        name: z.string().optional().describe("Simulation name"),
        engineVersion: z.string().optional().describe("Simulation engine version used for this prediction."),
        predictionEffectiveConfigHash: z.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity."),
        calibrationEvidence: calibrationEvidenceOutputSchema.optional().describe("Owned-versus-modeled evidence and latency boundary."),
        predictionEvidence: storedPredictionEvidenceSchema.optional(),
        appWeight: z.enum(["lean", "typical", "heavy"]).optional(),
        appWeightDefaulted: z.boolean().optional(),
        status: z.string().optional().describe("Current simulation status"),
        traffic: z.number().optional().describe("Current traffic in RPS"),
        scenarioHash: z.string().length(64).optional().describe("Canonical replay scenario graph hash."),
        effectiveConfigHash: z.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity."),
        replayIdentity: replayIdentitySchema.optional(),
        scenarioAttribution: mcpScenarioAttributionSchema.optional().describe(
          "Trusted server-side attribution copied from the live scenario catalog; absent for explicit resource-graph creates",
        ),
        resources: z
          .array(
            z
              .object({
                id: z.string().optional().describe("Resource ID"),
                name: z.string().optional().describe("Resource display name"),
                status: z.string().optional().describe("Health status (healthy/warning/critical/failed)"),
                cpuPercent: z.number().optional().describe("CPU utilization (%)"),
            routedRps: z.number().optional().describe("Requests per second routed to this resource (compute/kubernetes only)"),
            availabilityState: z
              .enum(["available", "degraded", "unavailable", "scaled_to_zero", "cold_start"])
              .optional()
              .describe("Availability derived from lifecycle and routed traffic; degraded can still serve, unavailable is failed/parked, scaled_to_zero and cold_start are Fargate no-task states"),
            isRoutable: z.boolean().optional().describe("Whether this compute/Kubernetes resource can receive traffic"),
            recoveryBlockedReason: z
              .string()
              .optional()
              .describe("Engine recovery guard currently blocking cooldown progress, when present"),
            recoveryProgress: z
              .object({
                state: z.enum(["parked", "blocked", "cooling_down", "healthy"]),
                parkWindow: z.object({
                  totalSteps: z.number(),
                  completedSteps: z.number(),
                  remainingSteps: z.number(),
                }),
                cooldown: z.object({
                  target: z.enum(["warning", "healthy"]).nullable(),
                  completedSteps: z.number(),
                  requiredSteps: z.number(),
                  remainingSteps: z.number(),
                }),
              })
              .optional()
              .describe("Read-only recovery progress; poll simulation.get or simulation.step until state is healthy"),
             ...compactFailureTelemetrySchema,
              })
              .passthrough()
          )
          .optional()
          .describe("Per-resource status summary (compact mode) or full resource states (full mode)"),
        effectiveMaxInstances: z
          .number()
          .optional()
          .describe("Fleet-size ceiling the engine enforces (autoscalingConfig.maxInstances or provider default)"),
        effectiveMinInstances: z
          .number()
          .optional()
          .describe("Fleet-size floor the engine enforces (autoscalingConfig.minInstances or provider default)"),
        normalizedConfig: normalizedConfigSchema.optional().describe(
          "Engine-resolved billing parameters for every resource: cost multipliers, hourly rates, autoscale thresholds " +
          "(scaleOut/scaleIn CPU %), GPU SKU, per-node token throughput, billing floors, connection limits. " +
          "Compare these against your intended configuration to confirm the engine is modelling what you designed."
        ),
        // Error / not_found shape.
        status_code: z.string().optional().describe("Set on error responses (e.g. not_found)"),
        message: z.string().optional().describe("Human-readable error message"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/simulations/${args.simulationId}`, undefined, true);
      if (args.responseMode === "full") return structuredResult(result);
      const sim = result !== null && typeof result === "object" ? (result as Record<string, unknown>) : {};
      const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
      const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
      const compact: Record<string, unknown> = {
        id: str(sim.id),
        name: str(sim.name),
        engineVersion: str(sim.engineVersion),
        predictionEffectiveConfigHash: str(sim.predictionEffectiveConfigHash),
        calibrationEvidence: sim.calibrationEvidence,
        predictionEvidence: sim.predictionEvidence,
        appWeight: sim.appWeight,
        appWeightDefaulted: sim.appWeightDefaulted,
        predictionEvidenceStatus: sim.predictionEvidenceStatus,
        status: simStatus(sim),
        traffic: num(sim.traffic),
        ...(typeof sim.scenarioHash === "string" ? { scenarioHash: sim.scenarioHash } : {}),
        ...(typeof sim.effectiveConfigHash === "string" ? { effectiveConfigHash: sim.effectiveConfigHash } : {}),
        ...(sim.scenarioAttribution !== undefined ? { scenarioAttribution: sim.scenarioAttribution } : {}),
        ...(sim.replayIdentity !== undefined ? { replayIdentity: sim.replayIdentity } : {}),
        resources: toCompactResources(Array.isArray(sim.resources) ? sim.resources : []),
        effectiveMaxInstances: num(sim.effectiveMaxInstances),
        effectiveMinInstances: num(sim.effectiveMinInstances),
        ...(sim.normalizedConfig !== undefined ? { normalizedConfig: sim.normalizedConfig } : {}),
      };
      for (const key of Object.keys(compact)) {
        if (compact[key] === undefined) delete compact[key];
      }
      return structuredResult(compact);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        return structuredResult({
          status_code: "not_found",
          message:
            "Simulation not found or has expired. Call simulation.create to start a new one, or simulation.list to view your active simulations.",
        });
      }
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.provider_api_limits",
  {
    title: "Simulate Provider API Limits",
    description:
      "Simulate provider quotas, API throttling, retries, backoff, queueing, worker/concurrency limits, and control-plane operations for an owned simulation. " +
      "This is a bounded, deterministic model of provider control-plane behavior: it calls the existing CWM provider-limit route, returns scheduler results plus catalog or caller-override provenance, and does not call AWS, Azure, GCP, DigitalOcean, OCI, or any live quota service. " +
      "Use this when the request is about provider API quotas, throttling, retries, backoff, queueing, workers, concurrency, or control-plane operations. Supply one service per request: the top-level service applies to every operation group, including dependency groups; compare different services in separate requests. Do not use simulation.step or /api/simulations/stateless for that intent: simulation.step advances resource-graph state, while the stateless simulator models cloud workload behavior rather than provider API limits. " +
      "Catalog-backed policies cover AWS EC2 mutating APIs (service: ec2, operation: mutating, category: compute; aws.ec2.mutating-api), ELBv1 and ELBv2 action-category buckets (service: elbv1 or elbv2, category: network; operation: resource-intensive, registration, non-mutating, or mutating; aws.elbv1.resource-intensive, aws.elbv1.registration, aws.elbv1.non-mutating, aws.elbv1.mutating, aws.elbv2.resource-intensive, aws.elbv2.registration, aws.elbv2.non-mutating, aws.elbv2.mutating), and Azure Resource Manager read/write buckets. Use the documented ELB category for an action; do not map arbitrary action names or uncategorized actions into a supported category, or conflate the v1/v2 buckets. For AWS EC2, represent create, update, and delete requests with operation: \"mutating\" (the API action names are not separate catalog operations). Aurora Serverless v1 Data API (service: rds-data-api-aurora-serverless-v1, category: database) has two independent limit models, NOT joint enforcement of one workload: requests-per-second (aws.rds-data-api-aurora-serverless-v1.requests-per-second) models 1,000 requests/s per account and Region, with no documented burst; its fixed 1-second scheduler window is an approximation, not AWS timing. concurrent-requests (aws.rds-data-api-aurora-serverless-v1.concurrent-requests) models 500 concurrent requests for ONE cluster using the SAME secret, queueing overflow. Both need quotaScope.account; concurrency additionally needs quotaScope.resource, an opaque cluster-secret-pair label, never the actual secret. Source: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Limits.html. Generic RDS control-plane, Aurora Serverless v2 Data API and provisioned Aurora Data API are unsupported by these selectors. IAM, generic RDS control-plane, EC2 Auto Scaling, Application Auto Scaling, and S3 control-plane tuples have no numeric scheduler-compatible public default here; S3 per-prefix object throughput is data-plane guidance, not a control-plane API limit. Try catalog-backed policy resolution first; add a caller-supplied override only when the exact provider/service/operation/category tuple is not covered or a concrete account, subscription, or project scope is required. Otherwise the result is a stable unsupported_policy outcome, not an HTTP 429. " +
      "A request mixing Aurora Serverless v1 Data API requests-per-second and concurrent-requests selectors is rejected; send separate requests and do not treat results as simultaneous enforcement. Canonical AWS EC2 workload (copy-pasteable MCP request): ```json {\"simulationId\":\"<simulationId>\",\"provider\":\"aws\",\"region\":\"us-east-1\",\"service\":\"ec2\",\"operations\":[{\"id\":\"create\",\"operation\":\"mutating\",\"category\":\"compute\",\"plannedCount\":80},{\"id\":\"update\",\"operation\":\"mutating\",\"category\":\"compute\",\"plannedCount\":80},{\"id\":\"delete\",\"operation\":\"mutating\",\"category\":\"compute\",\"plannedCount\":80}],\"workerCount\":8,\"concurrency\":8,\"maxConcurrency\":8,\"latency\":{\"meanMs\":40,\"p95Ms\":80,\"timeoutMs\":5000}} ``` This is 240 operations in three groups of 80. concurrency is the selected in-flight scheduler width, maxConcurrency is the request ceiling (and sweep bound), and workerCount is the worker cap; set all three to 8 for this example. " +
      "Inputs are bounded to the public request contract (256 operations, 100,000 planned units, 1,000 workers/concurrency, 16 sweep values, 10 retry attempts, a 1,000,000-event aggregate sweep budget shared across candidates, and a 2-second wall-clock deadline across the whole request). Oversized work is rejected before scheduling with non-retryable 413 PROVIDER_LIMIT_WORK_BUDGET. Two executions may run concurrently. A third request, or an identical active/recently interrupted request, returns a non-retryable 409 with PROVIDER_LIMIT_BUSY or PROVIDER_LIMIT_DUPLICATE; identical interrupted workloads remain guarded for five minutes. The response includes policy source, documentation reference, confidence, and as-of metadata when available. " +
      "Workflow: call simulation.create first and save its returned simulationId, pass that simulationId to simulation.provider_api_limits, inspect result.status and result.policyResolutions[].policySource (the canonical AWS example should return supported and catalog_default), then call simulation.delete with the same simulationId to clean up. The provider-limit workload is not persisted, does not create resources, and does not advance /step state. Requires CWM_API_KEY with read scope for this tool; simulation.create and simulation.delete require write scope. The likely next tool is simulation.delete for cleanup, or simulation.get or simulation.metrics if you want to confirm resource state was unchanged.",
    inputSchema: providerApiLimitMcpInputSchema,
    outputSchema: providerApiLimitMcpOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const { simulationId, ...request } = args;
      const result = await ctx.apiCall(
        "POST",
        `/api/simulations/${encodeURIComponent(simulationId)}/provider-api-limits`,
        request,
        true,
      );
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
);

server.registerTool(
  "rl.create",
  {
    title: "Create RL Environment",
    description:
      "Create a Gym-compatible reinforcement learning training environment linked to a simulation. " +
      "Use it when you want to train or evaluate an autoscaling agent with observation/action/reward loops; do not use it for one-off what-if analysis — plain simulation.step is simpler for that. " +
      "Requires an existing simulationId from simulation.create. Returns an environment id (consumed by rl.step, rl.reset, rl.observation) plus the initial observation vector. " +
      "The likely next tool is rl.step to take the first action. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation to wrap as an RL environment"),
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
      tickSeconds: z
        .number()
        .int()
        .min(1)
        .default(3600)
        .describe("Simulated seconds per environment tick (default 3600 = 1 hour). Controls the time-scale of cost and traffic patterns."),
    },
    outputSchema: z
      .object({
        id: z.string().optional().describe("RL environment ID — use with rl.step, rl.reset, rl.observation"),
        simulationId: z.string().optional().describe("Linked simulation ID"),
        observation: z.record(z.unknown()).optional().describe("Initial observation vector"),
        status: z.string().optional().describe("Environment status (active/completed)"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
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
        tickSeconds: args.tickSeconds,
      };
      if (args.targetTrafficPattern) episodeConfig.targetTrafficPattern = args.targetTrafficPattern;
      if (args.costBudgetPerHour !== undefined) episodeConfig.costBudgetPerHour = args.costBudgetPerHour;

      const result = await ctx.apiCall(
        "POST",
        "/api/rl/environments",
        { simulationId: args.simulationId, episodeConfig },
        true
      );
      // REST returns { environment: {...}, observation, ... } — surface the
      // environment's id/simulationId/status top-level per the output schema.
      const r = result as { environment?: Record<string, unknown> } & Record<string, unknown>;
      const env = r.environment ?? {};
      return structuredResult({
        ...r,
        id: env.id ?? r.id,
        simulationId: env.simulationId ?? r.simulationId,
        status: env.status ?? r.status,
      });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "rl.step",
  {
    title: "RL Step",
    description:
      "Execute one RL action in a training environment and receive the next observation, reward, done flag, and diagnostic info. " +
      "Use it as the inner loop of RL training; use rl.batch_step instead when you have a predetermined sequence of up to 30 actions. " +
      "Requires an environmentId from rl.create. The likely next tool is rl.step again while done=false, or rl.reset when done=true to start a new episode. Requires CWM_API_KEY with write scope.\n\nScaling scope: scale_out adds separate compute-type resource nodes (instances); scale_in removes those compute nodes. Neither action changes a Kubernetes resource's node count or characteristics.sessionAffinity.workload.replicas, the application workload-owner count. Configure sticky workload replicas and optional CPU-driven workload autoscaling on the Kubernetes resource before stepping; that autoscaling is model-driven behavior, not an exact manual in-run scale command. Resource-topology edits through simulation.update must be made before the first simulation step; after replay identity finalizes, resource/connection edits return 409.\n\nAction types:\n- scale_out: add compute instances\n- scale_in: remove compute instances\n- add_resource: add a new resource node\n- remove_resource: remove a resource node\n- adjust_threshold: change autoscaling CPU/latency/throughput thresholds\n- set_recovery_policy: set per-resource recovery thresholds (requires resourceId + criticalCpuThreshold/criticalSteps/warningCpuThreshold/warningSteps)",
    inputSchema: {
      environmentId: z.string().describe("ID of the RL environment (from rl.create)"),
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
      tick_seconds: z
        .number()
        .int()
        .min(1)
        .max(3600)
        .optional()
        .describe("Simulated seconds per step (1–3600). Overrides the environment default for this step only."),
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
    outputSchema: z
      .object({
        observation: z.record(z.unknown()).optional().describe("Next observation vector"),
        reward: z.number().optional().describe("Reward signal for this step"),
        done: z.boolean().optional().describe("True when the episode has ended; call rl.reset to start a new episode"),
        info: z.record(z.unknown()).optional().describe("Diagnostic information about this step"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
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

      const body: Record<string, unknown> = { action: { type: args.actionType, parameters } };
      if (args.tick_seconds !== undefined) body.tick_seconds = args.tick_seconds;

      const result = await ctx.apiCall(
        "POST",
        `/api/rl/environments/${args.environmentId}/step`,
        body,
        true
      );
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

// ── rl.validate_policy (dev-only, not in BAZAAR_INFO / CURATED_AGENT_OPS) ─
// Registered for development use during the policy-gate spike.
// Do NOT add to BAZAAR_INFO, CURATED_AGENT_OPS, or llms-full.txt until the
// spike is accepted for productionization.
server.registerTool(
  "rl.validate_policy",
  {
    title: "Validate Action Policy (Dev)",
    description:
      "Pre-validate an RL action against the four policy domains (budget, SLA, region, compliance) " +
      "without executing the step or mutating any state. " +
      "Returns a PolicyResult with all applicable violations. " +
      "Use this before rl.step to check whether an action would be blocked or warn. " +
      "This is a development/spike tool — not yet in the curated registry. " +
      "The likely next tool is rl.step to execute the validated action. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      environmentId: z.string().describe("ID of the RL environment to evaluate against"),
      actionType: z
        .enum(["adjust_threshold", "scale_out", "scale_in", "add_resource", "remove_resource", "set_recovery_policy", "no_op"])
        .describe("Type of action to pre-validate"),
      resourceId: z.string().optional().describe("Resource ID (for add_resource, remove_resource, set_recovery_policy)"),
      instanceCount: z.number().int().min(1).optional().describe("Instance count delta (scale_out / scale_in)"),
      resourceType: z.enum(["compute", "database", "storage", "network", "cache", "queue", "kubernetes"]).optional().describe("Resource type (add_resource)"),
      provider: z.enum(["aws", "gcp", "azure", "oci", "digitalocean"]).optional().describe("Cloud provider"),
      regionKey: z.string().optional().describe("Region key (e.g. use1, euw1) — checked against provider region list"),
      policyMode: z.enum(["warn", "block"]).optional().describe("Optional per-call mode override. May only escalate (warn→block), never relax (block→warn)."),
    },
    outputSchema: z.object({
      allowed: z.boolean().optional().describe("Whether the action is allowed under the current policy (absent when status=not_found)"),
      outcome: z.enum(["pass", "warn", "block"]).optional().describe("Policy evaluation outcome"),
      mode: z.enum(["warn", "block"]).optional().describe("Effective policy mode used"),
      violations: z.array(z.object({
        domain: z.enum(["budget", "sla", "region", "compliance"]),
        rule: z.string(),
        message: z.string(),
        severity: z.enum(["warning", "error"]),
      }).passthrough()).optional().describe("All policy violations found (never first-hit only)"),
      evaluatedAt: z.string().optional().describe("ISO timestamp of evaluation"),
      status: z.string().optional().describe("not_found when the environment does not exist"),
      message: z.string().optional().describe("Human-readable message (present when status=not_found)"),
    }).passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const parameters: Record<string, unknown> = {};
      if (args.resourceId    !== undefined) parameters.resourceId    = args.resourceId;
      if (args.instanceCount !== undefined) parameters.instanceCount = args.instanceCount;
      if (args.resourceType  !== undefined) parameters.resourceType  = args.resourceType;
      if (args.provider      !== undefined) parameters.provider      = args.provider;
      if (args.regionKey     !== undefined) parameters.regionKey     = args.regionKey;
      if (args.policyMode    !== undefined) parameters.policyMode    = args.policyMode;

      const result = await ctx.apiCall(
        "POST",
        `/api/rl/environments/${args.environmentId}/validate-action`,
        { action: { type: args.actionType, parameters } },
        true
      );
      return structuredResult(result);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        return structuredResult({
          status: "not_found",
          message: "RL environment not found. Use rl.create to create one.",
        });
      }
      return errorResult((err as Error).message);
    }
  }
);
// ─────────────────────────────────────────────────────────────────────────────

server.registerTool(
  "rl.reset",
  {
    title: "Reset RL Environment",
    description:
      "Reset an RL environment to begin a fresh training episode. " +
      "Use it when the done flag from rl.step is true (episode over) or to restart training from a clean state; do not use it mid-episode unless you intend to discard progress. " +
      "Requires an environmentId from rl.create. Returns the initial observation and new episode number. The likely next tool is rl.step. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      environmentId: z.string().describe("ID of the RL environment to reset"),
    },
    outputSchema: z
      .object({
        observation: z.record(z.unknown()).optional().describe("Initial observation vector for the new episode"),
        episodeNumber: z.number().optional().describe("New episode number after reset"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall(
        "POST",
        `/api/rl/environments/${args.environmentId}/reset`,
        {},
        true
      );
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "rl.batch_step",
  {
    title: "RL Batch Step",
    description:
      "Execute up to 30 RL actions in a single round-trip. More efficient than calling rl.step repeatedly when you have a predetermined action sequence. Returns an ordered array of step results (same shape as rl.step). Execution stops early if the episode ends (done=true). The likely next tool is rl.batch_step again while done=false, or rl.reset when done=true to begin a fresh episode. Requires CWM_API_KEY with write scope.\n\nScaling scope: scale_out adds separate compute-type resource nodes (instances); scale_in removes those compute nodes. Neither action changes a Kubernetes resource's node count or characteristics.sessionAffinity.workload.replicas, the application workload-owner count. Configure sticky workload replicas and optional CPU-driven workload autoscaling on the Kubernetes resource before stepping; that autoscaling is model-driven behavior, not an exact manual in-run scale command. Resource-topology edits through simulation.update must be made before the first simulation step; after replay identity finalizes, resource/connection edits return 409.\n\nAction types per step:\n- scale_out: add compute instances\n- scale_in: remove compute instances\n- add_resource: add a new resource node\n- remove_resource: remove a resource node\n- adjust_threshold: change autoscaling CPU/latency/throughput thresholds\n- set_recovery_policy: set per-resource recovery thresholds",
    inputSchema: {
      environmentId: z.string().describe("ID of the RL environment (from rl.create)"),
      steps: z
        .array(
          z.object({
            actionType: z
              .enum(["adjust_threshold", "scale_out", "scale_in", "add_resource", "remove_resource", "set_recovery_policy"])
              .describe("Type of autoscaling action to apply"),
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
            tick_seconds: z.number().int().min(1).max(3600).optional().describe("Simulated seconds for this step (overrides environment default)"),
          })
        )
        .min(1)
        .max(30)
        .describe("Ordered list of step actions to execute (1–30)"),
    },
    outputSchema: z
      .object({
        results: z
          .array(z.record(z.unknown()))
          .optional()
          .describe("Ordered step results; same shape as rl.step. May be shorter if episode ended early."),
        stoppedEarly: z.boolean().optional().describe("True if execution stopped early because done=true"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (args) => {
    try {
      const steps = args.steps.map((s) => {
        const parameters: Record<string, unknown> = {};
        if (s.resourceId !== undefined) parameters.resourceId = s.resourceId;
        if (s.instanceCount !== undefined) parameters.instanceCount = s.instanceCount;
        if (s.cpuThreshold !== undefined) parameters.cpuThreshold = s.cpuThreshold;
        if (s.latencyThreshold !== undefined) parameters.latencyThreshold = s.latencyThreshold;
        if (s.resourceType !== undefined) parameters.resourceType = s.resourceType;
        if (s.provider !== undefined) parameters.provider = s.provider;
        if (
          s.criticalCpuThreshold !== undefined ||
          s.criticalSteps !== undefined ||
          s.warningCpuThreshold !== undefined ||
          s.warningSteps !== undefined
        ) {
          parameters.recoveryPolicy = {
            criticalCpuThreshold: s.criticalCpuThreshold ?? 80,
            criticalSteps: s.criticalSteps ?? 4,
            warningCpuThreshold: s.warningCpuThreshold ?? 70,
            warningSteps: s.warningSteps ?? 3,
          };
        }
        const step: Record<string, unknown> = { action: { type: s.actionType, parameters } };
        if (s.tick_seconds !== undefined) step.tick_seconds = s.tick_seconds;
        return step;
      });
      const result = await ctx.apiCall(
        "POST",
        `/api/rl/environments/${args.environmentId}/batch-step`,
        { steps },
        true
      );
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "chaos.scenarios",
  {
    title: "List Chaos Scenarios",
    description:
      "List all pre-built chaos engineering scenarios available on this Cloud World Model instance. Returns scenario IDs, names, descriptions, and expected outcomes. Use the returned IDs with the chaos.run tool. No API key required.",
    inputSchema: {},
    outputSchema: z
      .object({
        scenarios: z
          .array(
            z
              .object({
                id: z.string().optional().describe("Scenario identifier"),
                name: z.string().optional().describe("Scenario display name"),
                description: z.string().optional().describe("What this scenario demonstrates"),
              })
              .passthrough()
          )
          .optional()
          .describe("Available chaos engineering scenarios"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    try {
      const result = await ctx.apiCall("GET", "/api/chaos/scenarios");
      const items = Array.isArray(result) ? result : [result];
      return arrayResult(items, "scenarios");
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "chaos.run",
  {
    title: "Run Chaos Experiment",
    description:
      "Inject a failure into a simulation and measure resilience (asynchronous). " +
      "Use it to discover architectural weak points — database crashes, zone outages, network partitions, and more; do not use it for simple load changes (simulation.inject_traffic) or routine stepping (simulation.step). " +
      "Requires a simulationId from simulation.create, plus either a scenarioId (browse with chaos.scenarios) or customInjections. " +
      "Custom injections can target a resource by targetResourceId or by targetResourceName (exact-then-prefix, case-insensitive; ambiguous names return a 400 with candidates). " +
      "For database_crash, set promotionDelaySeconds and restartDelaySeconds (integer simulation seconds, 0–86400; defaults 30 and 1800) either on the prebuilt database_crash scenario request or inside a custom database_crash injection, not both. Other scenario IDs reject these fields. Only an explicit healthy replicaOf relationship uses promotion; a sole writer restarts after the injection duration. A replica crashing at the same simulation instant is not eligible: the writer uses sole_writer_restart and databaseCrashAssumptions records promotionUnavailableReason; a replica lost after promotion is pending instead produces an Explicit replica promotion failed event. Connected independent writers are hard dependencies: if any required writer is crashed without its own promoted replica, all offered work fails (100% errors, zero goodput), whether one or multiple crashes overlap. A healthy unrelated writer cannot replace it; a non-serving reader crash does not interrupt service. With no connections, each writer is treated as required. Scalar servingResourceId describes only the first crash target and is null when that target is unavailable or aggregate service is down; databaseTargets shows each target's replacement. Chaos samples every 10 simulation seconds (default promotion at 30 seconds); quick simulation.inject_failure uses one-second steps and promotes on its second step (one second after injection). Compare matching phases, not equal step indices or wall-clock times. These are assumptions, not provider SLAs; chaos.results records effective values in resilienceScore.metrics.databaseCrashAssumptions. " +
      "Returns a job ID immediately — the experiment runs in the background. The next tool is chaos.status to poll progress, then chaos.results once completed. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation to run chaos against"),
      scenarioId: z
        .string()
        .optional()
        .describe(
          "Pre-built chaos scenario ID (e.g. az_outage, db_crash, network_partition, cascading_failure, cpu_stress). " +
            "Use chaos.scenarios to browse available IDs."
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
            targetResourceId: z.string().optional().describe("Specific resource to target by internal ID"),
            targetResourceName: z
              .string()
              .optional()
              .describe(
                "Specific resource to target by display name — resolved case-insensitively, exact match first then unique prefix; ambiguous names return a 400 listing candidates"
              ),
            targetZone: z.string().optional().describe("Availability zone to target"),
            intensity: z
              .number()
              .min(0)
              .max(100)
              .optional()
              .describe("Failure severity from 0 (minimal) to 100 (maximum)"),
            duration: z.number().optional().describe("Duration of the failure in simulation seconds"),
            promotionDelaySeconds: z.number().int().min(0).max(86400).optional().describe("database_crash only: simulated explicit-replica promotion delay (default 30 seconds), not a provider SLA"),
            restartDelaySeconds: z.number().int().min(0).max(86400).optional().describe("database_crash only: simulated sole-writer restart delay after injection ends (default 1800 seconds), not a provider SLA"),
          })
        )
        .optional()
        .describe("Custom failure injections — use instead of scenarioId for fine-grained control."),
      promotionDelaySeconds: z.number().int().min(0).max(86400).optional().describe("Prebuilt database_crash scenario only: simulated explicit-replica promotion delay (default 30 seconds), not a provider SLA"),
      restartDelaySeconds: z.number().int().min(0).max(86400).optional().describe("Prebuilt database_crash scenario only: simulated sole-writer restart delay after injection ends (default 1800 seconds), not a provider SLA"),
      duration: z
        .number()
        .min(10)
        .max(1000)
        .default(300)
        .describe("Total chaos experiment duration in simulation seconds (10–1000, default 300)"),
    },
    outputSchema: z
      .object({
        jobId: z.string().optional().describe("Job ID — pass to chaos.status to poll progress"),
        status: z.string().optional().describe("Initial job status (pending)"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = {
        simulationId: args.simulationId,
        duration: args.duration,
      };
      if (args.scenarioId) body.scenarioId = args.scenarioId;
      if (args.customInjections) body.customInjections = args.customInjections;
      if (args.promotionDelaySeconds !== undefined) body.promotionDelaySeconds = args.promotionDelaySeconds;
      if (args.restartDelaySeconds !== undefined) body.restartDelaySeconds = args.restartDelaySeconds;

      const result = await ctx.apiCall("POST", "/api/chaos/run", body, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "chaos.status",
  {
    title: "Chaos Job Status",
    description:
      "Poll the status of a chaos job. Status lifecycle: pending → running → completed | failed | cancelled. " +
      "Use it after chaos.run to track progress; do not use it to fetch the report itself — that is chaos.results. " +
      "Requires a jobId from chaos.run. Read-only and safe to repeat. " +
      "The next tool depends on status: when 'completed', call chaos.results; while 'pending' or 'running', call chaos.status again after a short wait. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      jobId: z.string().describe("Chaos job ID returned by chaos.run"),
    },
    outputSchema: z
      .object({
        id: z.string().optional().describe("Job ID"),
        status: z.string().optional().describe("Current status: pending | running | completed | failed | cancelled"),
        progress: z.number().optional().describe("Completion percentage (0–100)"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/chaos/jobs/${args.jobId}`, undefined, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "chaos.results",
  {
    title: "Chaos Job Results",
    description:
      "Requires a completed jobId from chaos.run/chaos.status. Returns resilienceScore with score, grade, scoringReason, metrics.outcome.recovery (null milestone means recovery not observed), peak sampled latencyP95Ms and bounded chaosIntervals (10-second simulation-clock offered RPS, errors, goodput and target/serving state); also returns vulnerabilities and timeline. For database_crash, metrics.databaseCrashAssumptions records each target's effective simulation-time delays and recovery mode, including defaults; promotionUnavailableReason indicates a related standby was unavailable at injection time, while a later loss appears as an Explicit replica promotion failed timeline event. Promotion requires an explicit healthy replicaOf relationship, which simulation.create materializes for AWS Aurora Serverless v2 multiAz:true with instanceCount:2. No further tool is required; this is a terminal report. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      jobId: z.string().describe("Chaos job ID returned by chaos.run"),
    },
    outputSchema: z
      .object({
        score: z.number().optional().describe("Overall resilience score (0–100)"),
        grade: z.string().optional().describe("Letter grade (A–F)"),
        vulnerabilities: z.array(z.record(z.unknown())).optional().describe("Discovered vulnerabilities with severity and remediation advice"),
        timeline: z.array(z.record(z.unknown())).optional().describe("Timeline of chaos events"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/chaos/jobs/${args.jobId}/results`, undefined, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "multicloud.explore",
  {
    title: "Multi-Cloud Explore",
    description:
      "All results from this tool are simulation-model outputs — they must not be presented as externally validated provider benchmarks, and consistency across runs reflects model stability, not real-world cloud behaviour. " +
      "Generate and score multi-cloud deployment strategies for a workload (asynchronous). Compares AWS, GCP, Azure, OCI, and DigitalOcean combinations across cost, latency, and vendor lock-in. " +
      "Use it when deciding which provider mix fits a workload's cost/latency/lock-in trade-offs; do not use it to simulate behaviour over time (simulation.create + simulation.step) or test failures (chaos.run). " +
      "No simulation required — it takes a workload description (instances, storage, traffic, latency SLA, region) directly. " +
      "Returns a job ID immediately. The next tool is multicloud.status to poll, then multicloud.results for the ranked strategies. Requires CWM_API_KEY with write scope.",
    inputSchema: {
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
        .array(z.string().describe("Region identifier (e.g. 'us-west-2', 'europe-west1')"))
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
    outputSchema: z
      .object({
        jobId: z.string().optional().describe("Job ID — pass to multicloud.status to poll progress"),
        status: z.string().optional().describe("Initial job status (pending)"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall(
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
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "multicloud.status",
  {
    title: "Multi-Cloud Job Status",
    description:
      "Poll the status of a multi-cloud exploration job. Status lifecycle: pending → running → completed | failed | cancelled. When completed, call multicloud.results. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      jobId: z.string().describe("Multi-cloud job ID returned by multicloud.explore"),
    },
    outputSchema: z
      .object({
        id: z.string().optional().describe("Job ID"),
        status: z.string().optional().describe("Current status: pending | running | completed | failed | cancelled"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/multi-cloud/jobs/${args.jobId}`, undefined, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "multicloud.results",
  {
    title: "Multi-Cloud Job Results",
    description:
      "All figures in these results are simulation-model outputs — they must not be presented as externally validated provider benchmarks, and cross-run consistency reflects model stability, not real-world cloud behaviour. " +
      "The response includes an interpretationScope object; consult it before forming any conclusion about provider performance — check planned claims against its prohibitedClaimCategories and treat load levels outside its testedLoadLevels as hypotheses requiring a new simulation run. " +
      "Retrieve the full results of a completed multi-cloud exploration job. Returns ranked deployment strategies with per-provider cost, latency, and vendor lock-in scores, plus a comparison report. The top-ranked candidate also has a preProvisionVerdict with decision (hold or ship_with_changes), the checks and evidence behind it, and explicit uncertainty. Multi-cloud exploration cannot return ship: it does not run failure injection, so resilience must be validated separately before deployment. " +
      "providerTrustLevels records the worst rateProvenance.basis behind each provider's cost figures. The likely next tool is multicloud.verdict to obtain a candidateFingerprint and submit completed caller-attested resilience evidence for that exact candidate and workload. Results are model estimates, not externally validated provider benchmarks. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      jobId: z.string().describe("Multi-cloud job ID returned by multicloud.explore"),
    },
    outputSchema: z
      .object({
        allStrategies: z.array(z.record(z.unknown())).optional().describe("All ranked deployment strategies returned by the REST results endpoint"),
        topStrategies: z.array(z.record(z.unknown())).optional().describe("Top-ranked deployment strategies returned by the REST results endpoint"),
        preProvisionVerdict: z.object({
          decision: z.enum(["ship", "hold", "ship_with_changes"]),
          strategy: z.object({ id: z.string(), name: z.string() }).nullable(),
          candidateFingerprint: z.string().nullable(),
          reasons: z.array(z.object({
            code: z.enum([
              "no_candidate_strategy",
              "cost_budget_exceeded",
              "latency_slo_missed",
              "error_budget_exceeded",
              "resilience_validation_required",
              "resilience_check_failed",
              "resilience_evidence_insufficient",
              "required_checks_incomplete",
              "required_checks_passed",
            ]),
            message: z.string(),
          })),
          evidence: z.object({
            cost: z.object({
              estimatedPerHour: z.number().nullable(),
              budgetCheck: z.enum(["pass", "fail", "not_provided"]),
            }),
            latency: z.object({
              estimatedP95Ms: z.number().nullable(),
              requirementMs: z.number(),
              sloCheck: z.enum(["pass", "fail", "not_evaluated"]),
              headroomPct: z.number().nullable(),
            }),
            errorRate: z.object({
              modeledFraction: z.number().nullable(),
              budgetCheck: z.enum(["pass", "fail", "not_provided"]),
            }),
            resilience: z.object({
              status: z.enum(["not_evaluated", "pass", "fail"]),
              reason: z.string(),
              provenance: z.enum(["recorded", "estimated"]).optional(),
              verification: z.literal("caller_attested").optional(),
              report: completedResilienceEvidenceSchema.optional(),
            }),
          }),
          uncertainty: z.object({
            dataSource: z.literal("simulation-model"),
            externallyValidated: z.literal(false),
            providerRateTrust: z.record(z.enum(["on-demand", "spot", "estimated"])),
            limitations: z.array(z.string()),
          }),
        }).optional().describe("Conservative, machine-readable verdict for topStrategies[0], including cost, latency, error-rate and resilience evidence"),
        providerTrustLevels: z
          .record(z.enum(["on-demand", "spot", "estimated"]))
          .optional()
          .describe(
            "Per-provider rate trust level — the worst rateProvenance.basis across the pricing constants behind that provider's cost figures. 'on-demand' = verified published list prices; 'estimated' = at least one contributing rate is a flat estimate, so treat that provider's ranking as approximate."
          ),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall(
        "GET",
        `/api/multi-cloud/jobs/${args.jobId}/results`,
        undefined,
        true
      );
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "multicloud.verdict",
  {
    title: "Finalize Pre-Provision Verdict",
    description:
      "Requires a completed jobId and strategyId from multicloud.results. Returns preProvisionVerdict and its candidateFingerprint. " +
      "First omit resilienceEvidence to obtain the fingerprint identifying the exact candidate architecture and workload; retain it with the test inputs. " +
      "Then submit a completed report only if those exact inputs were tested. Imported evidence is caller-attested, not authenticated as a CWM chaos job or independently verified. " +
      "Recorded and estimated provenance are preserved; only recorded failure injection, observed recovery, final health and a passing resilience check can complete the resilience gate. " +
      "Ship additionally requires passing cost, latency and error budgets, and remains a planning decision, not a production guarantee. " +
      "The likely next tool is multicloud.verdict with the completed resilienceEvidence; omit it to inspect an unfinalized candidate. " +
      "This read-only computation does not persist the report or change subsequent multicloud.results. Requires CWM_API_KEY with read scope.",
    inputSchema: { jobId: z.string(), ...preProvisionFinalizeRequestSchema.shape },
    outputSchema: z.object({ preProvisionVerdict: z.object({
      decision: z.enum(["ship", "hold", "ship_with_changes"]),
      candidateFingerprint: z.string().nullable(),
      evidence: z.object({
        resilience: z.object({
          status: z.enum(["not_evaluated", "pass", "fail"]),
          reason: z.string(),
          provenance: z.enum(["recorded", "estimated"]).optional(),
          verification: z.literal("caller_attested").optional(),
          report: completedResilienceEvidenceSchema.optional(),
        }),
      }).passthrough(),
    }).passthrough() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ jobId, ...body }) => {
    try {
      return structuredResult(await ctx.apiCall("POST", `/api/multi-cloud/jobs/${encodeURIComponent(jobId)}/verdict`, body, true));
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
);

server.registerTool(
  "prediction.validate",
  {
    title: "Prediction Validate",
    description:
      "Submit an infrastructure validation job: test a simulation against a traffic forecast and detect SLA violations and bottlenecks (asynchronous). " +
      "Use it to answer 'will this architecture survive this traffic pattern?' before it happens; do not use it for open-ended exploration (simulation.step) or failure injection (chaos.run). " +
      "Requires a simulationId from simulation.create and a time-series forecast (dataPoints). " +
      "Returns a job ID immediately. The next tool is prediction.status to poll, then prediction.results for bottleneck detections and recommended autoscaling thresholds. Requires CWM_API_KEY with write scope.",
    inputSchema: {
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
    outputSchema: z
      .object({
        jobId: z.string().optional().describe("Job ID — pass to prediction.status to poll progress"),
        status: z.string().optional().describe("Initial job status (pending)"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
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

      const result = await ctx.apiCall(
        "POST",
        "/api/predictions/validate",
        { simulationId: args.simulationId, trafficForecast, testSteps: args.testSteps },
        true
      );
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "prediction.status",
  {
    title: "Prediction Job Status",
    description:
      "Poll the status of a prediction job (validation or threshold optimization). Status lifecycle: pending → running → completed | failed | cancelled. When status is 'completed', call prediction.results for the full report. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      jobId: z.string().describe("Prediction job ID returned by prediction.validate or prediction.optimize_thresholds"),
    },
    outputSchema: z
      .object({
        id: z.string().optional().describe("Job ID"),
        status: z.string().optional().describe("Current status: pending | running | completed | failed | cancelled"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/predictions/jobs/${args.jobId}`, undefined, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "prediction.results",
  {
    title: "Prediction Job Results",
    description:
      "Retrieve the full results of a completed prediction job. Includes: detected bottlenecks with severity and timing, SLA violation windows, per-resource health during the forecast, and recommended autoscaling thresholds. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      jobId: z.string().describe("Prediction job ID returned by prediction.validate or prediction.optimize_thresholds"),
    },
    outputSchema: z
      .object({
        bottlenecks: z.array(z.record(z.unknown())).optional().describe("Detected bottlenecks with severity and timing"),
        slaViolations: z.array(z.record(z.unknown())).optional().describe("SLA violation windows"),
        recommendedThresholds: z.record(z.unknown()).optional().describe("Recommended autoscaling thresholds per resource"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/predictions/jobs/${args.jobId}/results`, undefined, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "optimization.run",
  {
    title: "Run Optimization Job",
    description:
      "Start an infrastructure optimization analysis job. The engine generates architecture variants, runs batch simulations, and produces ranked recommendations to minimize cost, maximize performance, or balance both. Returns a job ID immediately; poll optimization.status until completed, then call optimization.results for recommendations. Requires CWM_API_KEY with write scope.",
    inputSchema: {
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
    outputSchema: z
      .object({
        jobId: z.string().optional().describe("Job ID — pass to optimization.status to poll progress"),
        status: z.string().optional().describe("Initial job status (pending)"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
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

      const result = await ctx.apiCall(
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
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "optimization.status",
  {
    title: "Optimization Job Status",
    description:
      "Poll the status of an infrastructure optimization job. Status lifecycle: pending → running → completed | failed | cancelled. Reports how many architecture variants have been generated and evaluated. When completed, call optimization.results for recommendations. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      jobId: z.string().describe("Optimization job ID returned by optimization.run"),
    },
    outputSchema: z
      .object({
        id: z.string().optional().describe("Job ID"),
        status: z.string().optional().describe("Current status: pending | running | completed | failed | cancelled"),
        variantsGenerated: z.number().optional().describe("Number of architecture variants generated so far"),
        variantsEvaluated: z.number().optional().describe("Number of variants evaluated so far"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/analysis/jobs/${args.jobId}`, undefined, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "optimization.results",
  {
    title: "Optimization Job Results",
    description:
      "Retrieve the ranked infrastructure optimization recommendations for a completed job. Each recommendation includes a title, description, priority (critical/high/medium/low), the action to take, expected impact on cost/performance/reliability, and optionally suggested autoscaling configs or resource changes. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      jobId: z.string().describe("Optimization job ID returned by optimization.run"),
    },
    outputSchema: z
      .object({
        recommendations: z
          .array(
            z
              .object({
                title: z.string().optional().describe("Recommendation title"),
                priority: z.string().optional().describe("Priority: critical | high | medium | low"),
                action: z.string().optional().describe("Recommended action to take"),
                impact: z.record(z.unknown()).optional().describe("Expected impact on cost/performance/reliability"),
              })
              .passthrough()
          )
          .optional()
          .describe("Ranked optimization recommendations"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/analysis/jobs/${args.jobId}/recommendations`, undefined, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "prediction.optimize_thresholds",
  {
    title: "Prediction Optimize Thresholds",
    description:
      "Submit a threshold optimization job: run a traffic forecast through the simulation engine and derive recommended CPU/latency scale-out and scale-in thresholds for each resource tier. Uses the same forecast format as prediction.validate. Returns a job ID immediately; poll prediction.status until completed, then call prediction.results to retrieve the recommended threshold table. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation to derive thresholds for"),
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
        .describe("Number of simulation steps to run during threshold search (default 100)"),
    },
    outputSchema: z
      .object({
        jobId: z.string().optional().describe("Job ID — pass to prediction.status to poll progress"),
        status: z.string().optional().describe("Initial job status (pending)"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
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

      const result = await ctx.apiCall(
        "POST",
        "/api/predictions/optimize-thresholds",
        { simulationId: args.simulationId, trafficForecast, testSteps: args.testSteps },
        true
      );
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.inject_traffic",
  {
    title: "Inject Traffic",
    description:
      "Change a running simulation's traffic level in one call. Three modes: " +
      "(1) targetRps sets traffic to an exact absolute level, clamped 1–500,000 RPS (e.g. { targetRps: 700 } → exactly 700 RPS; mode 'target_rps'); " +
      "(2) deltaPercent applies a relative change — newTraffic = currentTraffic × (1 + deltaPercent/100), rounded (e.g. { deltaPercent: 75 } at 400 RPS → 700 RPS; mode 'delta_percent'). targetRps takes precedence if both are given. " +
      "(3) Set random: true (with no other fields) to inject a large RANDOM spike of +30,000–50,000 RPS on top of current traffic (mode 'random_spike'; if a ramp pattern is active it instead advances one increment, mode 'ramp_increment') — suitable for stress demos, NOT controlled scenarios; use targetRps/deltaPercent for precise load levels. random: true is mutually exclusive with targetRps and deltaPercent — passing both returns a 400. " +
      "Traffic persistence: a controlled inject (targetRps/deltaPercent) DEACTIVATES any active traffic patterns (names echoed in deactivatedPatterns), so the injected level persists across subsequent simulation.step calls instead of being pulled back toward a pattern target. " +
      "The response echoes the applied outcome: { previousRps, appliedRps, mode, requestedTargetRps?, requestedDeltaPercent? } plus the updated simulation and logged event. The likely next tool is simulation.step to observe the effect of the traffic change. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation to inject traffic into"),
      targetRps: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Absolute traffic target in RPS (clamped 1–500,000). Takes precedence over deltaPercent. Deactivates active traffic patterns so the level persists across steps."),
      deltaPercent: z
        .number()
        .optional()
        .describe("Relative traffic change in percent (e.g. 75 = +75% of current traffic; must be > -100). Ignored when targetRps is supplied."),
    },
    outputSchema: z
      .object({
        simulation: z.record(z.unknown()).optional().describe("Updated simulation state after the traffic change"),
        event: z.record(z.unknown()).optional().describe("Event logged for this traffic injection"),
        previousRps: z.number().optional().describe("Traffic level (RPS) before this call"),
        appliedRps: z.number().optional().describe("Traffic level (RPS) after this call"),
        mode: z.string().optional().describe("Applied injection mode: target_rps, delta_percent, random_spike, or ramp_increment"),
        requestedTargetRps: z.number().optional().describe("Echo of the targetRps request field (present only when supplied)"),
        requestedDeltaPercent: z.number().optional().describe("Echo of the deltaPercent request field (present only when supplied)"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = {};
      if (args.targetRps !== undefined) body.targetRps = args.targetRps;
      if (args.deltaPercent !== undefined) body.deltaPercent = args.deltaPercent;
      // If no targeting parameters, explicitly opt into random spike selection
      if (body.targetRps === undefined && body.deltaPercent === undefined) body.random = true;
      const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/inject-traffic`, body, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.inject_failure",
  {
    title: "Inject Failure",
    description:
      "Fail one compute/Kubernetes node or database in a running simulation (marked critical, not removed). A targeted database outage is bounded and reversible: no serving database means 100% errors and zero goodput at positive load; use simulation.recover_resource to restore it early, or step through the park window for automatic capacity restoration and cooldown. An AWS Aurora writer declaring characteristics.auroraStandbyResourceId (populated by simulation.create for multiAz:true, instanceCount:2 Serverless v2) requires a healthy related replicaOf standby; multiAz or another DB alone is not sufficient. The first step has no serving writer, and promotion on the second step restores service without a residual writer-failure penalty. Read metrics.databases[].auroraFailover and the promotion event for failed and standby IDs and success, plus errorRate, throughput and errorBreakdown.dbFailure. Each quick step is one modeled simulation second: promotion on step two is one second after injection, not 30 seconds. Chaos database_crash instead samples every 10 seconds and defaults to a 30-second promotion and a 1800-second sole-writer restart after its injection duration. Compare the equivalent unavailable/serving phases, not equal step indices or wall-clock times. This is modeled, not observed AWS behavior. " +
      "Exact targeting: pass resourceName (human-readable name, e.g. 'app-server-01'; exact match preferred, an unambiguous prefix is accepted) or resourceId to fail a specific resource — including an individual named instance, not only a group. " +
      "If resourceName matches multiple resources the call fails with a 400 listing every matching candidate by name — retry with one exact name (or its resourceId) from that list. " +
      "The database must be healthy; an already failed database returns a 400 describing its current status. " +
      "When neither parameter is supplied, a RANDOM healthy compute/Kubernetes node is selected (not a database) — this path is non-deterministic and NOT suitable for controlled scenarios or CI replay; always target by name/id when reproducing a precise fault sequence. " +
      "The response always echoes the applied outcome via resolvedResourceId, resolvedResourceName, and previousHealth (populated from the selected resource on the random path too). " +
      "For typed, durational database failures use failure.create with database_overload (requires an API key); instance_kill PERMANENTLY removes the instance (failure.delete does not restore it), while instance_down is reversible. Network, storage, cache, queue, and security resource types are not supported by quick injection. " +
      "Use simulation.events to review the full event log after injecting. The likely next tool is simulation.step to observe the failure propagating through the system. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation to inject a node failure into"),
      resourceName: z
        .string()
        .optional()
        .describe("Optional: name of the resource to fail (exact match preferred; unambiguous prefix accepted). Ambiguous names return a 400 with a candidate list."),
      resourceId: z
        .string()
        .optional()
        .describe("Optional: ID of the resource to fail. Takes precedence over resourceName."),
    },
    outputSchema: z
      .object({
        resources: z.array(z.record(z.unknown())).optional().describe("Updated resource list after failure injection"),
        event: z.record(z.unknown()).optional().describe("Failure event that was logged"),
        resolvedResourceId: z.string().optional().describe("ID of the resource that was failed (targeted or randomly selected)"),
        resolvedResourceName: z.string().optional().describe("Name of the resource that was failed"),
        previousHealth: z.string().optional().describe("The resource's health status immediately before the failure was applied"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = {};
      if (args.resourceName !== undefined) body.resourceName = args.resourceName;
      if (args.resourceId !== undefined) body.resourceId = args.resourceId;
      // If no targeting parameters, explicitly opt into random selection
      if (body.resourceName === undefined && body.resourceId === undefined) body.random = true;
      const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/inject-failure`, body, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.events",
  {
    title: "Get Simulation Events",
    description:
      "Retrieve the full ordered event log for a simulation. Events include scale-out/in actions, failure injections, cost spikes, bottleneck alerts, routing changes, and autoscaling triggers — the primary audit trail for understanding what happened during a run. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation whose event log to retrieve"),
    },
    outputSchema: z
      .object({
        events: z
          .array(
            z
              .object({
                id: z.string().optional().describe("Event ID"),
                type: z.string().min(1).describe("Event type (e.g. scale_out, failure_injection, cost_spike)"),
                timestamp: z.string().optional().describe("ISO timestamp at which the event occurred"),
                message: z.string().optional().describe("Human-readable description of the event"),
              })
              .passthrough()
          )
          .optional()
          .describe("Ordered event log entries"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/simulations/${args.simulationId}/events`, undefined, true);
      const items = Array.isArray(result) ? result : [result];
      return arrayResult(items, "events");
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.delete",
  {
    title: "Delete Simulation",
    description:
      "Permanently delete a simulation and all of its associated metrics, events, snapshots, and failure injections. This action is irreversible. Requires CWM_API_KEY with write scope and ownership of the simulation.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation to delete"),
    },
    outputSchema: z
      .object({
        deleted: z.boolean().optional().describe("True if the simulation was successfully deleted"),
        id: z.string().optional().describe("ID of the deleted simulation"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("DELETE", `/api/simulations/${args.simulationId}`, undefined, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "snapshot.create",
  {
    title: "Create Snapshot",
    description:
      "Pin the current simulation state as a named snapshot for later comparison. Captures resources, latest metrics, active failures, and significant recent events. Returns a pinId you can use with snapshot.get to retrieve the pinned state later. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation to snapshot"),
      label: z.string().optional().describe("Optional human-readable label for this snapshot (e.g. 'before scale-out')"),
    },
    outputSchema: z
      .object({
        pinId: z.string().optional().describe("Pin ID — use with snapshot.get or snapshot.list"),
        label: z.string().nullable().optional().describe("Snapshot label (null when omitted)"),
        pinnedAt: z.string().optional().describe("ISO timestamp at which the snapshot was pinned"),
        simulationId: z.string().optional().describe("ID of the snapshotted simulation"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = {};
      if (args.label !== undefined) body.label = args.label;
      const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/snapshots`, body, true);
      // REST returns { pinnedSnapshotId, pinnedAt, label, simulationId } — surface pinId.
      const r = result as Record<string, unknown>;
      return structuredResult({
        pinId: r.pinnedSnapshotId ?? r.pinId,
        label: r.label ?? null,
        pinnedAt: r.pinnedAt,
        simulationId: r.simulationId,
      });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "snapshot.list",
  {
    title: "List Snapshots",
    description:
      "List all pinned snapshots for a simulation in reverse chronological order (newest first). Returns summary entries with pinId, label, pinnedAt timestamp, and top-level metrics — use snapshot.get to retrieve full detail for a specific pin. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation whose snapshots to list"),
    },
    outputSchema: z
      .object({
        snapshots: z
          .array(
            z
              .object({
                pinId: z.string().optional().describe("Snapshot pin ID"),
                label: z.string().nullable().optional().describe("Snapshot label (null when omitted)"),
                pinnedAt: z.string().optional().describe("ISO timestamp when pinned"),
              })
              .passthrough()
          )
          .optional()
          .describe("Snapshot summary entries, newest first"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/simulations/${args.simulationId}/snapshots`, undefined, true);
      const r = result as { snapshots?: unknown[] } | unknown[];
      const raw = Array.isArray(r) ? r : (r as { snapshots?: unknown[] }).snapshots ?? [];
      // REST entries use `id`; the MCP contract promises `pinId`.
      const snapshots = (raw as Record<string, unknown>[]).map((s) => ({ ...s, pinId: s.pinId ?? s.id }));
      return structuredResult({ snapshots });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "snapshot.get",
  {
    title: "Get Snapshot",
    description:
      "Retrieve a specific pinned snapshot by its pin ID. Returns the full snapshot payload: resources at pin time, latest metrics, active failures, and the significant events that were captured. Useful for before/after comparisons after scaling or failure injection. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation that owns the snapshot"),
      pinId: z.string().describe("Pin ID returned by snapshot.create or snapshot.list"),
    },
    outputSchema: z
      .object({
        pinId: z.string().optional().describe("Snapshot pin ID"),
        label: z.string().nullable().optional().describe("Snapshot label (null when omitted)"),
        pinnedAt: z.string().optional().describe("ISO timestamp when pinned"),
        simulationId: z.string().optional().describe("ID of the snapshotted simulation"),
        data: z
          .record(z.unknown())
          .optional()
          .describe("Full snapshot payload: architecture, metrics, activeFailures, recentEvents, recommendations"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/simulations/${args.simulationId}/snapshots/${args.pinId}`, undefined, true);
      // REST returns { id, label, pinnedAt, simulationId, data } — surface pinId.
      const r = result as Record<string, unknown>;
      return structuredResult({ ...r, pinId: r.pinId ?? r.id });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "ai.explain",
  {
    title: "AI Explain",
    description:
      "Submit an async AI analysis job to explain the simulation's current behavior. Returns a jobId immediately (no 502 timeout). Poll ai.status until completed, then call ai.results to retrieve the natural-language explanation. Set beginnerMode for jargon-free output. Requires CWM_API_KEY.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation to explain"),
      beginnerMode: z.boolean().optional().describe("Set to true for simplified, beginner-friendly explanations (default false)"),
    },
    outputSchema: z
      .object({
        jobId: z.string().optional().describe("AI job ID — use with ai.status and ai.results"),
        status: z.string().optional().describe("Initial job status (pending)"),
        createdAt: z.string().optional().describe("ISO timestamp when the job was created"),
        message: z.string().optional().describe("Instructions for polling"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = { simulationId: args.simulationId, type: "explain" };
      if (args.beginnerMode !== undefined) body.beginnerMode = args.beginnerMode;
      const result = await ctx.apiCall("POST", "/api/ai-jobs", body, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "ai.troubleshoot",
  {
    title: "AI Troubleshoot",
    description:
      "Submit an async AI troubleshooting job for a specific problem in the simulation. Returns a jobId immediately (no 502 timeout). Poll ai.status until completed, then call ai.results to retrieve the diagnosis and remediation steps. Requires CWM_API_KEY.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation to troubleshoot"),
      issue: z.string().describe("Description of the problem to troubleshoot (e.g. 'latency spiking after 500 RPS', 'cost doubled after scale-out')"),
      beginnerMode: z.boolean().optional().describe("Set to true for simplified, beginner-friendly explanations (default false)"),
    },
    outputSchema: z
      .object({
        jobId: z.string().optional().describe("AI job ID — use with ai.status and ai.results"),
        status: z.string().optional().describe("Initial job status (pending)"),
        createdAt: z.string().optional().describe("ISO timestamp when the job was created"),
        message: z.string().optional().describe("Instructions for polling"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = { simulationId: args.simulationId, type: "troubleshoot", issue: args.issue };
      if (args.beginnerMode !== undefined) body.beginnerMode = args.beginnerMode;
      const result = await ctx.apiCall("POST", "/api/ai-jobs", body, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "ai.analyze",
  {
    title: "AI Analyze Bottlenecks",
    description:
      "Submit an async AI bottleneck detection job for the simulation. Returns a jobId immediately (no 502 timeout). Poll ai.status until completed, then call ai.results to retrieve the ranked bottleneck list and remediation suggestions. Requires CWM_API_KEY.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation to analyze for bottlenecks"),
      beginnerMode: z.boolean().optional().describe("Set to true for simplified, beginner-friendly explanations (default false)"),
    },
    outputSchema: z
      .object({
        jobId: z.string().optional().describe("AI job ID — use with ai.status and ai.results"),
        status: z.string().optional().describe("Initial job status (pending)"),
        createdAt: z.string().optional().describe("ISO timestamp when the job was created"),
        message: z.string().optional().describe("Instructions for polling"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = { simulationId: args.simulationId, type: "analyze_bottlenecks" };
      if (args.beginnerMode !== undefined) body.beginnerMode = args.beginnerMode;
      const result = await ctx.apiCall("POST", "/api/ai-jobs", body, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "ai.status",
  {
    title: "AI Job Status",
    description:
      "Poll the status of an async AI analysis job (explain, troubleshoot, analyze_bottlenecks, or optimize). Status lifecycle: pending → running → completed | failed | cancelled. When completed, call ai.results to retrieve the full output. Requires CWM_API_KEY.",
    inputSchema: {
      jobId: z.string().describe("AI job ID returned by ai.explain, ai.troubleshoot, ai.analyze, or ai.optimize"),
    },
    outputSchema: z
      .object({
        id: z.string().optional().describe("Job ID"),
        status: z.string().optional().describe("Current status: pending | running | completed | failed | cancelled"),
        jobType: z.string().optional().describe("Type of analysis: explain | troubleshoot | analyze_bottlenecks | optimize"),
        simulationId: z.string().optional().describe("Simulation that was analyzed"),
        createdAt: z.string().optional().describe("ISO timestamp when the job was created"),
        completedAt: z.string().optional().describe("ISO timestamp when the job completed (if done)"),
        error: z.string().optional().describe("Error message if the job failed"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/ai-jobs/${args.jobId}`, undefined, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "ai.results",
  {
    title: "AI Job Results",
    description:
      "Retrieve the full results of a completed AI analysis job. Call ai.status first to confirm the job is completed. Results vary by job type: explain returns explanation string; troubleshoot returns guidance string; analyze_bottlenecks returns analysis string + doRecommendation object; optimize returns suggestions string array. Requires CWM_API_KEY.",
    inputSchema: {
      jobId: z.string().describe("AI job ID returned by ai.explain, ai.troubleshoot, ai.analyze, or ai.optimize"),
    },
    outputSchema: z
      .object({
        explanation: z.string().optional().describe("Natural-language explanation (explain jobs)"),
        guidance: z.string().optional().describe("Troubleshooting guidance (troubleshoot jobs)"),
        analysis: z.string().optional().describe("Bottleneck analysis (analyze_bottlenecks jobs)"),
        doRecommendation: z.object({
          suggestedDropletSize: z.string().optional(),
          estimatedHourlyRate: z.number().optional(),
          estimatedMonthlyCost: z.number().optional(),
          currentHourlyCost: z.number().optional(),
          estimatedHourlySavings: z.number().optional(),
          estimatedMonthlySavings: z.number().optional(),
          savingsPercent: z.number().optional(),
          savingsIsComputed: z.boolean().optional(),
          reason: z.string().optional(),
          numDroplets: z.number().optional(),
        }).passthrough().nullable().optional().describe("DigitalOcean-specific recommendation object (analyze_bottlenecks jobs)"),
        suggestions: z.array(z.string()).optional().describe("Optimization suggestions string array (optimize jobs)"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const statusResult = await ctx.apiCall("GET", `/api/ai-jobs/${args.jobId}`, undefined, true);
      const s = statusResult as Record<string, unknown>;
      if (s.status !== "completed") {
        return notReadyResult(
          "job_not_complete",
          `AI job is not completed yet (status: ${s.status}). Poll ai.status until completed before calling this tool.`,
          "ai.status"
        );
      }
      const result = await ctx.apiCall("GET", `/api/ai-jobs/${args.jobId}/results`, undefined, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "rl.list",
  {
    title: "List RL Environments",
    description:
      "List all RL training environments owned by the API key. Returns environment IDs, linked simulation IDs, active/completed status, episode progress, cumulative reward, and idle-expiry timestamps. Use rl.create to start a new one. Requires CWM_API_KEY with read scope.",
    inputSchema: {},
    outputSchema: z
      .object({
        environments: z
          .array(
            z
              .object({
                id: z.string().optional().describe("Environment ID"),
                simulationId: z.string().optional().describe("Linked simulation ID"),
                status: z.string().optional().describe("active | completed"),
                episodeNumber: z.number().optional().describe("Current episode number"),
                cumulativeReward: z.number().optional().describe("Total accumulated reward"),
              })
              .passthrough()
          )
          .optional()
          .describe("RL environments owned by this API key"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (_args) => {
    try {
      const result = await ctx.apiCall("GET", "/api/rl/environments", undefined, true);
      const r = result as { environments?: unknown[] } | unknown[];
      const environments = Array.isArray(r) ? r : (r as { environments?: unknown[] }).environments ?? r;
      return structuredResult({ environments });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "rl.observation",
  {
    title: "Get RL Observation",
    description:
      "Manually poll the current observation vector for an RL environment without advancing the episode. Returns the obs struct (rps, cpu_util, instances, traffic, tick_seconds, warmup_factor) and metrics struct (cost_usd_hr, latency_p95, error_rate, uptime, sla_violations). Useful for inspecting state between rl.step calls. The likely next tool is rl.step to take the next action. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      environmentId: z.string().describe("RL environment ID returned by rl.create"),
    },
    outputSchema: z
      .object({
        obs: z
          .object({
            rps: z.number().optional().describe("Current requests per second"),
            cpu_util: z.number().optional().describe("CPU utilization (0–1)"),
            instances: z.number().optional().describe("Current number of compute instances"),
            traffic: z.number().optional().describe("Traffic in RPS"),
            tick_seconds: z.number().optional().describe("Seconds per tick"),
            warmup_factor: z.number().optional().describe("Warm-up ramp factor (0–1)"),
          })
          .passthrough()
          .optional()
          .describe("Observation vector"),
        metrics: z
          .object({
            cost_usd_hr: z.number().optional().describe("Cost in USD per hour"),
            latency_p95: z.number().optional().describe("P95 latency in ms"),
            error_rate: z.number().optional().describe("Error rate (%)"),
            uptime: z.number().optional().describe("Uptime fraction (0–1)"),
            sla_violations: z.number().optional().describe("Number of SLA violations"),
          })
          .passthrough()
          .optional()
          .describe("Current environment metrics"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/rl/environments/${args.environmentId}/observation`, undefined, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "rl.eval",
  {
    title: "Evaluate RL Episodes",
    description:
      "Run one or more deterministic evaluation episodes against an RL environment by replaying ordered action sequences. Each episode resets to the baseline state and then executes the provided actions in order, recording per-step rewards and a final cumulative score. Use this to benchmark a trained policy without modifying the live environment state. Returns a job ID immediately for async mode; poll rl.eval_status for the result. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      environmentId: z.string().describe("RL environment ID to evaluate against"),
      episodes: z
        .array(
          z.array(
            z.object({
              actionType: z.enum(["scale_out", "scale_in", "add_resource", "remove_resource", "adjust_threshold", "set_recovery_policy", "no_op"]).describe("Action to execute"),
              resourceId: z.string().optional().describe("Target resource ID"),
              instanceCount: z.number().int().optional().describe("Number of instances to add or remove"),
              cpuThreshold: z.number().optional().describe("New CPU scale-out threshold (for adjust_threshold)"),
              latencyThreshold: z.number().optional().describe("New latency threshold in ms (for adjust_threshold)"),
            })
          )
        )
        .min(1)
        .max(10)
        .describe("Array of episodes; each episode is an ordered list of actions to replay"),
      collapseThreshold: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Fraction drop in reward that triggers reward_collapse detection (default 0.20)"),
    },
    outputSchema: z
      .object({
        id: z.string().optional().describe("Eval job ID — pass to rl.eval_status to poll progress"),
        status: z.string().optional().describe("Initial job status (pending)"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (args) => {
    try {
      // REST evalEpisodesRequestSchema expects rlActionSchema objects:
      // { type, parameters: { resourceId, instanceCount, cpuThreshold, ... } }.
      // Map the agent-friendly flat MCP action shape into that envelope.
      const actions = args.episodes.map((episode) =>
        episode.map((a) => {
          const parameters: Record<string, unknown> = {};
          if (a.resourceId !== undefined) parameters.resourceId = a.resourceId;
          if (a.instanceCount !== undefined) parameters.instanceCount = a.instanceCount;
          if (a.cpuThreshold !== undefined) parameters.cpuThreshold = a.cpuThreshold;
          if (a.latencyThreshold !== undefined) parameters.latencyThreshold = a.latencyThreshold;
          return { type: a.actionType, parameters };
        })
      );
      const body: Record<string, unknown> = { actions };
      if (args.collapseThreshold !== undefined) body.collapseThreshold = args.collapseThreshold;
      const result = await ctx.apiCall(
        "POST",
        `/api/rl/environments/${args.environmentId}/eval-episodes`,
        body,
        true
      );
      // REST 202 returns { jobId, status, createdAt } — the schema promises `id`.
      const r = result as Record<string, unknown>;
      return structuredResult({ ...r, id: r.id ?? r.jobId });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "rl.eval_status",
  {
    title: "RL Eval Job Status",
    description:
      "Poll the status of an async RL evaluation job. Status lifecycle: pending → running → completed | failed. When completed, call rl.eval_results to retrieve the full per-episode scores. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      environmentId: z.string().describe("RL environment ID the eval job belongs to"),
      jobId: z.string().describe("Eval job ID returned by rl.eval"),
    },
    outputSchema: z
      .object({
        status: z.string().optional().describe("Current status: pending | running | completed | failed"),
        jobId: z.string().optional().describe("Job ID"),
        createdAt: z.string().optional().describe("ISO timestamp when the job was created"),
        completedAt: z.string().optional().describe("ISO timestamp when the job completed (if done)"),
        error: z.string().optional().describe("Error message if the job failed"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall(
        "GET",
        `/api/rl/environments/${args.environmentId}/eval-episodes/${args.jobId}`,
        undefined,
        true
      );
      const r = result as Record<string, unknown>;
      return structuredResult({ status: r.status, jobId: r.id, createdAt: r.createdAt, completedAt: r.completedAt, error: r.error });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "rl.eval_results",
  {
    title: "RL Eval Job Results",
    description:
      "Retrieve the full results of a completed RL eval job. Returns per-episode cumulative rewards, per-step reward breakdowns, and reward_collapse flags. Call rl.eval_status first to confirm the job has completed. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      environmentId: z.string().describe("RL environment ID the eval job belongs to"),
      jobId: z.string().describe("Eval job ID returned by rl.eval"),
    },
    outputSchema: z
      .object({
        episodes: z
          .array(
            z
              .object({
                cumulativeReward: z.number().optional().describe("Total reward for this episode"),
                rewards: z.array(z.number()).optional().describe("Per-step reward breakdown"),
                rewardCollapse: z.boolean().optional().describe("True if reward collapse was detected"),
              })
              .passthrough()
          )
          .optional()
          .describe("Per-episode evaluation results"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall(
        "GET",
        `/api/rl/environments/${args.environmentId}/eval-episodes/${args.jobId}`,
        undefined,
        true
      );
      const r = result as Record<string, unknown>;
      if (r.status !== "completed") {
        return notReadyResult(
          "job_not_complete",
          `Job is not completed yet (status: ${r.status}). Poll rl.eval_status until completed before calling this tool.`,
          "rl.eval_status"
        );
      }
      return structuredResult(r.result ?? result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "ai.optimize",
  {
    title: "AI Optimize",
    description:
      "Submit an async AI optimization job for the simulation. Returns a jobId immediately (no 502 timeout). Poll ai.status until completed, then call ai.results to retrieve ranked infrastructure recommendations. Set beginnerMode for simplified explanations. Requires CWM_API_KEY.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation to optimize"),
      beginnerMode: z.boolean().optional().describe("Set to true for simplified, beginner-friendly suggestions (default false)"),
    },
    outputSchema: z
      .object({
        jobId: z.string().optional().describe("AI job ID — use with ai.status and ai.results"),
        status: z.string().optional().describe("Initial job status (pending)"),
        createdAt: z.string().optional().describe("ISO timestamp when the job was created"),
        message: z.string().optional().describe("Instructions for polling"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = { simulationId: args.simulationId, type: "optimize" };
      if (args.beginnerMode !== undefined) body.beginnerMode = args.beginnerMode;
      const result = await ctx.apiCall("POST", "/api/ai-jobs", body, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "traffic.create",
  {
    title: "Create Traffic Pattern",
    description:
      "Create a persistent traffic pattern for a simulation (ramp, burst, step, wave, or spike). Unlike simulation.inject_traffic, this creates a named, manageable pattern that persists across steps and can be updated or deleted via traffic.update/traffic.delete. Returns the created pattern with its patternId. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation to add the pattern to"),
      type: z.enum(["ramp", "burst", "step", "wave", "custom"]).describe("Traffic pattern type"),
      name: z.string().optional().describe("Human-readable name for the pattern (required by the API; defaults to '<type>-<timestamp>' if omitted)"),
      startTime: z.number().optional().describe("Simulation step at which the pattern begins (default 0)"),
      rpsTarget: z
        .number()
        .min(0)
        .optional()
        .describe(
          "Target RPS for the pattern. Mapped per type: ramp/step → parameters.endTraffic; burst → parameters.peakTraffic; wave → parameters.amplitude. " +
          "Ignored when the explicit 'parameters' field already contains the canonical key.",
        ),
      durationSteps: z.number().int().min(1).optional().describe("Number of simulation steps for this pattern to run"),
      endTime: z.number().nonnegative().optional().describe("Simulation step at which the pattern stops being active; preserved independently of durationSteps"),
      parameters: z.record(z.unknown()).optional().describe("Additional pattern-specific parameters (e.g. { rampRate: 100, peakRPS: 5000 })"),
    },
    outputSchema: z
      .object({
        id: z.string().optional().describe("Pattern ID — use with traffic.update and traffic.delete"),
        type: z.string().optional().describe("Pattern type"),
        name: z.string().optional().describe("Pattern name"),
        startTime: z.number().optional().describe("Simulation step at which the pattern starts"),
        endTime: z.number().optional().describe("Simulation step at which the pattern stops being active"),
        parameters: z.record(z.unknown()).optional().describe("Persisted pattern parameters"),
        isActive: z.boolean().optional().describe("Whether the pattern is currently active"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = {
        type: args.type,
        name: args.name ?? `${args.type}-${Date.now()}`,
        startTime: args.startTime ?? 0,
      };
      if (args.durationSteps !== undefined) body.durationSteps = args.durationSteps;
      if (args.endTime !== undefined) body.endTime = args.endTime;
      // Merge caller-supplied parameters first, then translate rpsTarget into
      // the canonical per-type parameters key (only when the key is not already
      // present in the explicit parameters block).
      const merged: Record<string, unknown> = { ...(args.parameters as Record<string, unknown> | undefined) };
      if (args.rpsTarget !== undefined) {
        if (args.type === "burst") {
          if (merged.peakTraffic === undefined) merged.peakTraffic = args.rpsTarget;
        } else if (args.type === "wave") {
          if (merged.amplitude === undefined) merged.amplitude = args.rpsTarget;
        } else {
          // ramp / step / custom — map to the most common target field
          if (merged.endTraffic === undefined) merged.endTraffic = args.rpsTarget;
        }
      }
      if (Object.keys(merged).length > 0) body.parameters = merged;
      const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/patterns`, body, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "traffic.update",
  {
    title: "Update Traffic Pattern",
    description:
      "Update an existing traffic pattern by its patternId. Supports partial updates — only the fields you provide are changed. The likely next tool is simulation.step to observe the updated pattern driving traffic. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      patternId: z.string().describe("Pattern ID returned by traffic.create"),
      rpsTarget: z.number().min(0).optional().describe("New target RPS"),
      durationSteps: z.number().int().min(1).optional().describe("New step duration"),
      parameters: z.record(z.unknown()).optional().describe("Pattern-specific parameters to merge/update"),
      isActive: z.boolean().optional().describe("Set to false to deactivate the pattern without deleting it"),
    },
    outputSchema: z
      .object({
        id: z.string().optional().describe("Pattern ID"),
        isActive: z.boolean().optional().describe("Whether the pattern is currently active"),
        rpsTarget: z.number().optional().describe("Updated target RPS"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = {};
      if (args.rpsTarget !== undefined) body.rpsTarget = args.rpsTarget;
      if (args.durationSteps !== undefined) body.durationSteps = args.durationSteps;
      if (args.parameters !== undefined) body.parameters = args.parameters;
      if (args.isActive !== undefined) body.isActive = args.isActive;
      const result = await ctx.apiCall("PATCH", `/api/patterns/${args.patternId}`, body, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "traffic.delete",
  {
    title: "Delete Traffic Pattern",
    description:
      "Delete a traffic pattern by its patternId. The pattern is removed permanently from the simulation. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      patternId: z.string().describe("Pattern ID returned by traffic.create"),
    },
    outputSchema: z
      .object({
        deleted: z.boolean().optional().describe("True if the pattern was successfully deleted"),
        patternId: z.string().optional().describe("ID of the deleted pattern"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      await ctx.apiCall("DELETE", `/api/patterns/${args.patternId}`, undefined, true);
      return structuredResult({ deleted: true, patternId: args.patternId });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "failure.create",
  {
    title: "Create Failure Injection",
    description:
       "Inject a persistent, typed failure into a simulation via the lifecycle API. Supports instance_kill, instance_down, az_outage, database_overload, network_latency, and bounded AWS EKS spot_interruption failures. " +
      "IMPORTANT: instance_kill PERMANENTLY removes the instance from the simulation — deleting the failure afterwards does NOT restore it. " +
      "To inject a reversible single-node outage use instance_down instead: it marks the node critical/unresponsive without removing it, and failure.update (isActive: false) or failure.delete restores the node to healthy. " +
       "For database_overload set top-level severity (minor, moderate, severe; default moderate) OR intensity (0–1, mapped to severity); the modeled impact increases with offered database load, and the returned severity is the effective setting. Do not place either field inside parameters. " +
       "Requires a simulationId from simulation.create. Returns the created failure record with its id consumed by failure.update/delete. The likely next tool is simulation.step. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation to inject the failure into"),
      type: z.enum(["instance_kill", "instance_down", "az_outage", "region_outage", "permanent_data_loss", "database_overload", "network_latency", "spot_interruption"]).describe("Type of failure to inject. instance_kill removes an instance; permanent_data_loss destroys original data irreversibly; region_outage affects service availability; spot_interruption models the bounded AWS EKS notice and migration lifecycle"),
      name: z.string().optional().describe("Human-readable label for this failure injection (required by the API; defaults to '<type>-<timestamp>' if omitted)"),
      startTime: z.number().optional().describe("Simulation step at which the failure begins (default 0)"),
      targetResourceId: z.string().optional().describe("ID of the specific resource to target (required for instance_kill; optional for others)"),
      targetRegion: z.string().optional().describe("Canonical region key; region_outage requires this and targetProvider"),
      targetZone: z.string().optional().describe("Canonical zone key; permanent_data_loss zone scopes require targetProvider"),
      targetProvider: z.enum(["aws", "gcp", "azure", "oci", "digitalocean"]).optional().describe("Cloud provider qualifying a regional or zonal failure scope"),
      severity: z.enum(["minor", "moderate", "severe"]).optional().describe("Top-level database_overload severity (default moderate); mutually exclusive with intensity"),
      intensity: z.number().min(0).max(1).optional().describe("Alternative database_overload control: 0–<0.34 minor, 0.34–<0.67 moderate, 0.67–1 severe. Do not combine with severity"),
       parameters: z.record(z.unknown()).optional().describe("Type-specific parameters (e.g. { azId: 'us-east-1a' } for az_outage, { latencyMs: 200 } for network_latency, or { spotInterruption: { workloadReplicas, imageSizeMiB, pullBandwidthMiBPerSecond, schedulingCapacity, startupSeconds, interruptionHandling } } for EKS Spot)"),
      isActive: z.boolean().optional().describe("Whether the failure should be active immediately (default true)"),
    },
    outputSchema: z
      .object({
        id: z.string().optional().describe("Failure ID — use with failure.update and failure.delete"),
        type: z.string().optional().describe("Failure type"),
        isActive: z.boolean().optional().describe("Whether the failure is currently active"),
        severity: z.enum(["minor", "moderate", "severe"]).optional().describe("Effective severity, including when intensity was supplied"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = {
        type: args.type,
        name: args.name ?? `${args.type}-${Date.now()}`,
        startTime: args.startTime ?? 0,
      };
      if (args.targetResourceId !== undefined) body.targetResourceId = args.targetResourceId;
      if (args.targetRegion !== undefined) body.targetRegion = args.targetRegion;
      if (args.targetZone !== undefined) body.targetZone = args.targetZone;
      if (args.targetProvider !== undefined) body.targetProvider = args.targetProvider;
      if (args.severity !== undefined) body.severity = args.severity;
      if (args.intensity !== undefined) body.intensity = args.intensity;
      if (args.parameters !== undefined) body.parameters = args.parameters;
      if (args.isActive !== undefined) body.isActive = args.isActive;
      const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/failures`, body, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "failure.update",
  {
    title: "Update Failure Injection",
    description:
      "Update an existing failure injection by its failureId. Use isActive: false to deactivate/resolve the failure without deleting it. " +
      "For instance_down and database_overload failures, setting isActive: false restores snapshotted capacity but leaves health recovery to subsequent qualifying simulation steps; one deactivation event records the failure id and step. instance_kill cannot be reversed this way (the instance was permanently removed). The likely next tool is simulation.step to observe the resource recovering. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      failureId: z.string().describe("Failure ID returned by failure.create"),
      isActive: z.boolean().optional().describe("Set to false to resolve/deactivate the failure"),
      parameters: z.record(z.unknown()).optional().describe("Updated failure parameters to merge"),
    },
    outputSchema: z
      .object({
        id: z.string().optional().describe("Failure ID"),
        isActive: z.boolean().optional().describe("Whether the failure is still active"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = {};
      if (args.isActive !== undefined) body.isActive = args.isActive;
      if (args.parameters !== undefined) body.parameters = args.parameters;
      const result = await ctx.apiCall("PATCH", `/api/failures/${args.failureId}`, body, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "failure.delete",
  {
    title: "Delete Failure Injection",
    description:
      "Permanently delete a failure injection by its failureId. " +
      "For instance_down and database_overload failures the target resource is restored to healthy status. " +
      "For instance_kill failures this removes only the record — it does NOT restore the deleted instance (the kill is permanent); use instance_down when you need a reversible outage. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      failureId: z.string().describe("Failure ID returned by failure.create"),
    },
    outputSchema: z
      .object({
        deleted: z.boolean().optional().describe("True if the failure was successfully deleted"),
        failureId: z.string().optional().describe("ID of the deleted failure"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      await ctx.apiCall("DELETE", `/api/failures/${args.failureId}`, undefined, true);
      return structuredResult({ deleted: true, failureId: args.failureId });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.resize",
  {
    title: "Bulk Resize Compute",
    description:
      "Resize all compute resources in a DigitalOcean simulation to a new droplet size in one call. DIGITALOCEAN-ONLY: returns a 400 PROVIDER_MISMATCH error (with no mutation) when the simulation's compute resources use any other provider (AWS, GCP, Azure, OCI) — it never changes a resource's provider. Do NOT use this tool for failure recovery on any provider; use simulation.recover_resource instead. Applies the new size tier (hourly rate, throughput cap) to every compute node simultaneously. Use simulation.list to find the simulationId. The likely next tool is simulation.step to observe the resized fleet under load. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      simulationId: z.string().describe("ID of the DigitalOcean simulation to resize"),
      dropletSize: z.string().describe("Target droplet size label (e.g. 's-1vcpu-1gb', 's-2vcpu-4gb', 's-4vcpu-8gb', 's-8vcpu-16gb', 'c-4'). Must be a valid DigitalOcean droplet size supported by the platform."),
    },
    outputSchema: z
      .object({
        resized: z.number().optional().describe("Number of compute resources resized"),
        dropletSize: z.string().optional().describe("Applied droplet size"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/bulk-resize`, { dropletSize: args.dropletSize }, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.recover_resource",
  {
    title: "Recover Failed Resource",
    description:
      "Recover a single failed resource in a simulation (any provider). Before calling this tool, lower traffic to a serviceable level so recovery is not blocked by the failure park window or idle CPU floor. Clears the resource's failure state: deactivates in-effect REVERSIBLE failure injections targeting it (instance_down, database_overload), restores snapshotted characteristics, and resets its health counters to zero so the engine counts only subsequent qualifying steps. STRICTLY SCOPED to the targeted resource — other resources that remain failed are NOT affected, so after recovery you can call simulation.get and assert the recovered resource is healthy while other failed resources stay failed. The response echoes the applied outcome, including stepsToHealthy: a lower-bound estimate of the simulation.step calls needed before the resource reads healthy again under the current recovery policy (default lower bound: 7 from critical). The response also sets stepsToHealthyIsLowerBound: true because an explicitly failed resource may need an additional failure-park transition before cooldown resumes, and any CPU threshold breach resets cooldown. Step at least stepsToHealthy times, then poll simulation.get until the resource is healthy. Provide resourceName OR resourceId. Errors (400) when the resource is not found or already healthy. NOT for instance_kill: that failure type permanently REMOVES the resource from the simulation, so it cannot be recovered (400 RESOURCE_KILLED) — re-add the resource via simulation.update, or prefer inject_failure type instance_down when you want a reversible outage. The likely next tool is simulation.step to advance the simulation and let the recovery progress. Requires CWM_API_KEY with write scope. " +
      "The response also includes recoveryProgress immediately after recovery starts: state is parked, blocked, cooling_down, or healthy; parkWindow and cooldown report the current completed and remaining steps. Poll simulation.get or simulation.step and stop only when recoveryProgress.state is healthy. ",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation containing the failed resource"),
      resourceName: z.string().optional().describe("Name of the failed resource to recover (case-insensitive exact match). Provide this or resourceId."),
      resourceId: z.string().optional().describe("ID of the failed resource to recover. Provide this or resourceName."),
    },
    outputSchema: z
      .object({
        resolvedResourceId: z.string().optional().describe("ID of the resource that was recovered"),
        resolvedResourceName: z.string().optional().describe("Name of the resource that was recovered"),
        previousHealth: z.string().optional().describe("Resource status before recovery (e.g. 'critical', 'warning')"),
        recoveryState: z.string().optional().describe("Always 'recovering' on success"),
        stepsToHealthy: z.number().optional().describe("Lower-bound number of simulation.step calls before the resource may be healthy; step at least this many, then poll simulation.get"),
        stepsToHealthyIsLowerBound: z.boolean().optional().describe("Always true: failure-park transitions or CPU threshold breaches can require more steps than stepsToHealthy"),
        recoveryProgress: z.object({
          state: z.enum(["parked", "blocked", "cooling_down", "healthy"]),
          parkWindow: z.object({
            totalSteps: z.number(),
            completedSteps: z.number(),
            remainingSteps: z.number(),
          }),
          cooldown: z.object({
            target: z.enum(["warning", "healthy"]).nullable(),
            completedSteps: z.number(),
            requiredSteps: z.number(),
            remainingSteps: z.number(),
          }),
        }).optional().describe("Current recovery stage; poll simulation.get or simulation.step until state is healthy"),
        deactivatedFailureIds: z.array(z.string()).optional().describe("Failure injections deactivated as part of the recovery"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (args) => {
    try {
      const body: Record<string, string> = {};
      if (args.resourceName) body.resourceName = args.resourceName;
      if (args.resourceId) body.resourceId = args.resourceId;
      const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/recover-resource`, body, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.claim",
  {
    title: "Claim Simulation",
    description:
      "Claim ownership of a simulation using the current API key. Useful when a simulation was created anonymously (via the UI) and you want to associate it with your API key for persistent access and multi-step automation. Returns the updated simulation. The likely next tool is simulation.step or simulation.metrics to continue driving the simulation. Requires CWM_API_KEY with write scope.",
    inputSchema: {
      simulationId: z.string().describe("ID of the unclaimed simulation to claim"),
    },
    outputSchema: z
      .object({
        id: z.string().optional().describe("Simulation ID"),
        name: z.string().optional().describe("Simulation name"),
        claimed: z.boolean().optional().describe("True if the simulation is now owned by this API key"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/claim`, {}, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "benchmark.validate",
  {
    title: "Validate Accuracy",
    description:
      "Validate the cost and performance accuracy of a simulation against real-world provider reference data. Returns cost accuracy (±10% threshold) and performance accuracy (±15% threshold) scores, plus an overallValid flag. Use this to verify your simulation is within acceptable drift before using its output for production decisions. Requires CWM_API_KEY.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation to validate"),
    },
    outputSchema: z
      .object({
        costAccuracy: z.number().optional().describe("Cost accuracy score (0–1; ≥0.9 means within 10% of real-world cost)"),
        performanceAccuracy: z.number().optional().describe("Performance accuracy score (0–1; ≥0.85 means within 15% of real-world perf)"),
        overallValid: z.boolean().optional().describe("True when both cost and performance accuracy are within thresholds"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/simulations/${args.simulationId}/validate-accuracy`, undefined, true);
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "benchmark.list",
  {
    title: "List Benchmarks",
    description:
      "List accuracy benchmark results for all supported AWS 6th-generation instance types (m6i, c6i, r6i families). Returns per-instance overall score, cost score, latency score, and performance score — useful for comparing which instance tier simulates most accurately for your workload. No authentication required.",
    inputSchema: {},
    outputSchema: z
      .object({
        instances: z
          .array(
            z
              .object({
                instanceType: z.string().optional().describe("AWS instance type (e.g. m6i.large)"),
                overallScore: z.number().optional().describe("Overall simulation accuracy score (0–100)"),
                costScore: z.number().optional().describe("Cost accuracy score (0–100)"),
                latencyScore: z.number().optional().describe("Latency accuracy score (0–100)"),
                performanceScore: z.number().optional().describe("Performance accuracy score (0–100)"),
              })
              .passthrough()
          )
          .optional()
          .describe("Per-instance benchmark accuracy results"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (_args) => {
    try {
      const result = await ctx.apiCall("GET", "/api/accuracy-benchmark/instances");
      const r = result as { instances?: unknown[] } | unknown[];
      const instances = Array.isArray(r) ? r : (r as { instances?: unknown[] }).instances ?? r;
      return structuredResult({ instances });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.right_sizing_hint",
  {
    title: "Get Right-Sizing Hint",
    description:
      "Fetch right-sizing recommendations for an existing simulation after 3 or more steps have been run. " +
      "Returns hints for over-provisioned or under-provisioned resources — compute downsizes when CPU has been low, " +
      "GPU node-count adjustments when GPU utilization is sustained under 40% or above 90%, and a managed-API cost comparison " +
      "when self-hosted inference cost-per-million-tokens exceeds the breakeven threshold. " +
      "Prerequisites: a simulationId from simulation.create or simulation.list, and at least 3 steps completed via simulation.step " +
      "(GPU inference hints additionally require 3 steps with gpuUtilization present in metrics). " +
      "Returns no identifiers consumed by other tools — use affectedResourceId + recommendedSlug with simulation.apply_right_sizing to apply a hint in one call. " +
      "The likely next tool is simulation.apply_right_sizing to act on the recommendation, or simulation.step to gather more data first. " +
      "Output fields: hasHint (boolean), hints[] — each with resourceType, reason " +
      "(low_cpu_util | scale_in | both | low_cpu | gpu-underutilized | gpu-saturated | gpu-api-breakeven), " +
      "affectedResourceId, affectedResourceName, recommendedSlug, hourlyRate, estimatedSavingsPct, tradeOffNote, currentUtilization. " +
      "Requires CWM_API_KEY with read scope, or x402 payment (right_sizing_hint, $0.0030).",
    inputSchema: {
      simulationId: z
        .string()
        .describe("ID of the simulation to analyze. Obtain from simulation.create or simulation.list."),
    },
    outputSchema: z
      .object({
        hasHint: z.boolean().describe("True when at least one right-sizing recommendation is available"),
        hints: z
          .array(
            z
              .object({
                resourceType: z
                  .string()
                  .optional()
                  .describe("Resource category the hint applies to (compute | kubernetes | database | network | storage)"),
                reason: z
                  .string()
                  .optional()
                  .describe(
                    "Hint trigger code: low_cpu_util, scale_in, both, low_cpu (compute downsizes); " +
                    "gpu-underutilized, gpu-saturated (node-count); gpu-api-breakeven (cost crossover)"
                  ),
                affectedResourceId: z.string().nullable().optional().describe("Resource ID of the affected resource"),
                affectedResourceName: z.string().nullable().optional().describe("Display name of the affected resource"),
                recommendedSlug: z
                  .string()
                  .optional()
                  .describe("Recommended size label or configuration slug (e.g. 't3.small', '2× A100 nodes', 'Managed model API @ $X/M tokens')"),
                hourlyRate: z.number().optional().describe("Estimated hourly cost in USD after applying the recommendation"),
                estimatedSavingsPct: z
                  .number()
                  .optional()
                  .describe("Estimated cost reduction as a percentage (0 for scale-out reliability hints)"),
                tradeOffNote: z
                  .string()
                  .optional()
                  .describe("Human-readable explanation of the trade-off and breakeven conditions"),
                currentUtilization: z
                  .number()
                  .nullable()
                  .optional()
                  .describe("Latest utilization reading that triggered this hint (CPU % or GPU %)"),
              })
              .passthrough()
          )
          .optional()
          .describe("Right-sizing recommendations — absent when hasHint is false"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall(
        "GET",
        `/api/simulations/${args.simulationId}/right-sizing-hint`,
        undefined,
        true
      );
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.apply_right_sizing",
  {
    title: "Apply Right-Sizing Hint",
    description:
      "Apply a right-sizing recommendation from simulation.right_sizing_hint directly to the targeted resource in one call. " +
      "Pass the affectedResourceId and recommendedSlug from the hint; the server validates the slug against the resource's " +
      "available sizes before mutating anything — it returns a 400 UNKNOWN_SIZE error (with a list of valid slugs) " +
      "instead of silently applying an unsupported size. " +
      "Supported resource types: compute, database, storage (any provider). GPU node-count hints " +
      "(reason: gpu-underutilized, gpu-saturated) and managed-API breakeven hints (reason: gpu-api-breakeven) " +
      "produce non-slug recommendedSlugs and cannot be applied via this tool — act on them through simulation.update instead. " +
      "Cross-provider DigitalOcean alternatives (a DO slug on a non-DO resource) are accepted; the resource's " +
      "cost characteristics are updated to the DO tier without changing the provider. " +
      "Prerequisites: a simulationId from simulation.create or simulation.list, a resourceId and recommendedSlug " +
      "from simulation.right_sizing_hint. The likely next tool is simulation.step to observe the resized resource under load. " +
      "Requires CWM_API_KEY with write scope.",
    inputSchema: {
      simulationId: z.string().describe("ID of the simulation containing the resource to resize"),
      resourceId: z.string().describe("ID of the resource to resize — use affectedResourceId from simulation.right_sizing_hint"),
      recommendedSlug: z.string().describe("Size slug to apply — use recommendedSlug from simulation.right_sizing_hint (e.g. 't3.small', 'n1-standard-1', 's-1vcpu-2gb')"),
    },
    outputSchema: z
      .object({
        resourceId: z.string().optional().describe("ID of the resized resource"),
        resourceName: z.string().optional().describe("Display name of the resized resource"),
        appliedSlug: z.string().optional().describe("The size slug that was applied"),
        costMultiplier: z.number().optional().describe("Cost multiplier for the new size tier"),
        isDoAlternative: z.boolean().optional().describe("True when the applied slug is a DigitalOcean cross-provider alternative for a non-DO resource"),
      })
      .passthrough(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall(
        "POST",
        `/api/simulations/${args.simulationId}/apply-right-sizing`,
        { resourceId: args.resourceId, recommendedSlug: args.recommendedSlug },
        true
      );
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "scenario.list",
  {
    title: "List Scenarios",
    description:
        "List the built-in demo scenarios as compact catalog cards — stable IDs, title/name, description, difficulty, tags, category, duration, provider summary, resource/connection counts, named active/optional traffic phases, and retry-workload disclosure. " +
        "Use it as the first call when you want a ready-made architecture instead of designing one; the cards intentionally omit resource, connection, traffic-pattern, and failure-injection graphs. " +
        "No prerequisites. Optionally narrow discovery with provider, category, and/or difficulty filters; omit them to receive the complete catalog. Pass a returned id as scenarioId to simulation.create for server-side expansion, or pass it to scenario.get when you need to inspect or customize the full graph. " +
        "Returns named activeFailurePhases and optionalFailurePhases with type, resource/zone target, severity, and step range. No API key required. The likely next tool is scenario.get.",
    inputSchema: scenarioListInputSchema,
    outputSchema: z
      .object({
        scenarios: z
          .array(scenarioCardSchema)
          .describe("Available demo scenarios"),
      })
      .passthrough(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", scenarioListPath(args));
      const scenarios = (Array.isArray(result) ? result : []).map(toCompactScenarioCard);
      return structuredResult({ scenarios });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "scenario.get",
  {
    title: "Get Scenario",
    description:
      "Hydrate one built-in scenario from the live Cloud World Model scenario library. " +
      "Prerequisite: a scenario id returned by scenario.list. Returns the complete selected scenario graph, including resources and connections plus optional seed, resilienceConfig, protectedResilienceConfig, traffic/failure presets, named traffic-phase summaries, activeFailurePhases and optionalFailurePhases (type, resource/zone target, severity, step range), retry-workload disclosure, and real-world incident metadata. " +
      "The response includes both title and name for compatibility; pass resources and connections, and optionally seed/resilienceConfig, to simulation.create when you need to edit or inspect the graph. For the shorter handoff, pass the id as scenarioId instead. " +
      "The likely next tool is simulation.create. Requires CWM_API_KEY with read scope.",
    inputSchema: {
      scenarioId: z.string().min(1).describe("Scenario identifier returned by scenario.list"),
    },
    outputSchema: scenarioGetOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const result = await ctx.apiCall("GET", `/api/scenarios/${encodeURIComponent(args.scenarioId)}`);
      return structuredResult(hydrateScenario(result));
    } catch (err) {
      if ((err as { status?: number }).status === 404) {
        return structuredResult({
          status: "not_found",
          message: `Scenario '${args.scenarioId}' was not found in the live scenario library.`,
        });
      }
      return errorResult((err as Error).message);
    }
  }
);

server.registerTool(
  "simulation.compare_resilience",
  {
    title: "Compare Resilience Configurations",
    description:
      "Replay the simulation's current traffic profile under two resilience configurations — a baseline and a mitigated config — and return side-by-side metrics so you can quantify the improvement from a resilience change. " +
      "Use it after running simulation.step with resilienceConfig enabled to compare 'before and after' scenarios: e.g. enabling a circuit breaker, tightening retry budgets, or adding load-shedding. " +
      "The complete agent workflow: (1) configure via simulation.create or simulation.update with resilienceConfig, (2) step the simulation several times to establish a traffic baseline, " +
      "(3) call this tool to compare baseline vs mitigated config — the delta.retryAmplificationFactor and delta.errorRate fields are the key headline metrics, " +
      "(4) if delta is positive (worse), tighten circuitBreaker.failureRateThreshold or lower retryBudgetRatio, (5) if the outcome is 'cascading' or 'degraded', add load-shedding or reduce maxCascadeDepth, " +
      "(6) replay with the improved config as the new mitigatedConfig until the delta is negative (better). " +
      "Prerequisites: a simulationId from simulation.create or simulation.list, with a resilienceConfig already attached (or provide an explicit baselineConfig in the request). " +
      "Each run includes a machine-readable incidentOutcome with the root trigger, retry amplification, peak original/attempted RPS, retry-path error rate, affected dependency IDs, activated controls, recovery time, containment, and replay metadata. " +
      "Returns a ResilienceComparison id-less object (no persistent artifact). The likely next tool is simulation.step to continue the experiment or simulation.update to persist the improved resilienceConfig. " +
      "Requires CWM_API_KEY with write scope. Wallet-session callers (JWT from x402-session) are also supported — no additional x402 payment required.",
    inputSchema: {
      simulationId: z
        .string()
        .describe("ID of the simulation to compare resilience for. Required — obtain from simulation.create or simulation.list."),
      steps: z
        .number()
        .int()
        .min(1)
        .max(120)
        .default(20)
        .optional()
        .describe("Number of simulation steps to replay for both runs (1–120; default 20). More steps = more representative peak metrics."),
      baselineConfig: z
        .object({
          enabled: z.boolean().optional(),
          dependencies: z.array(z.record(z.unknown())).max(64).optional(),
          scheduledFaults: z.array(z.record(z.unknown())).max(32).optional(),
          maxCascadeDepth: z.number().int().min(1).max(8).optional(),
          maxGeneratedRps: z.number().positive().max(500000).optional(),
          maxStepWork: z.number().int().min(1).max(2048).optional(),
          retryGeneratedTrafficAffectsCost: z.boolean().optional(),
        })
        .passthrough()
        .optional()
        .describe("Explicit baseline resilience config. When omitted, the simulation's current resilienceConfig is used. Returns 400 when both are absent."),
      mitigatedConfig: z
        .object({
          enabled: z.boolean().optional().default(true),
          dependencies: z
            .array(z.record(z.unknown()))
            .max(64)
            .optional()
            .describe("Dependency edges for the mitigated run"),
          scheduledFaults: z
            .array(z.record(z.unknown()))
            .max(32)
            .optional()
            .describe("Scheduled faults for the mitigated run"),
          maxCascadeDepth: z.number().int().min(1).max(8).optional(),
          maxGeneratedRps: z.number().positive().max(500000).optional(),
          maxStepWork: z.number().int().min(1).max(2048).optional(),
          retryGeneratedTrafficAffectsCost: z.boolean().optional(),
        })
        .passthrough()
        .describe("Required: the mitigated resilience config to evaluate against the baseline. Typically the same as baselineConfig but with improved settings (e.g. circuitBreaker.enabled: true)."),
      mitigatedResources: z
        .array(z.record(z.unknown()))
        .max(256)
        .optional()
        .describe("Optional complete resource array for the mitigated run, used to compare capacity or topology changes against the unchanged baseline resources."),
      mitigatedAutoscalingConfig: z
        .object({
          scaleOutCpuThreshold: z.number().optional(),
          scaleInCpuThreshold: z.number().optional(),
          scaleOutThroughputThreshold: z.number().optional(),
          scaleInThroughputThreshold: z.number().optional(),
          scaleOutLatencyThreshold: z.number().optional(),
          cooldownSeconds: z.number().optional(),
          minInstances: z.number().int().positive().optional(),
          maxInstances: z.number().int().positive().optional(),
        })
        .passthrough()
        .optional()
        .describe("Optional autoscaling override for the mitigated run, enabling a fair comparison of autoscaling corrections from the identical baseline state."),
    },
    outputSchema: z
      .object({
        seed: z.number().optional().describe("RNG seed used for both replay runs"),
        startStep: z.number().optional().describe("Simulation step at which both runs began"),
        traffic: z.number().optional().describe("Traffic level (RPS) at the start of the replay window"),
        steps: z.number().optional().describe("Number of steps replayed"),
        baseline: z
          .object({
            peakRetryAmplificationFactor: z.number().nullable().optional().describe("Peak retry amplification factor in the baseline run"),
            peakErrorRate: z.number().optional().describe("Peak error rate (%) in the baseline run"),
            peakLatencyP95: z.number().optional().describe("Peak P95 latency (ms) in the baseline run"),
            totalServedRequests: z.number().optional().describe("Total served requests across all baseline steps"),
            totalShedRequests: z.number().optional().describe("Total shed requests across all baseline steps"),
            finalOutcome: z.string().optional().describe("Incident outcome at the last baseline step: stable | degraded | cascading | protected | recovered"),
            incidentOutcome: z.object({
              rootTrigger: z.object({
                faultIds: z.array(z.string()),
                faultTypes: z.array(z.string()),
                targetResourceIds: z.array(z.string()),
                dependencyIds: z.array(z.string()),
                firstActiveStep: z.number().nullable(),
              }).describe("Scheduled fault or faults that initiated the replayed incident"),
              retryAmplificationFactor: z.number().nullable(),
              peakOriginalRps: z.number(),
              peakAttemptedRps: z.number(),
              peakErrorRate: z.number(),
              affectedDependencyIds: z.array(z.string()),
              protectiveControlsActivated: z.array(z.string()),
              timeToRecoverySteps: z.number().nullable(),
              cascadeContained: z.boolean(),
              runMetadata: z.object({
                seed: z.number(),
                startStep: z.number(),
                endStep: z.number(),
                steps: z.number(),
                trafficRps: z.number(),
                configVersion: z.number(),
                faultIds: z.array(z.string()),
              }).passthrough(),
            }).passthrough().optional().describe("Generic, machine-readable baseline incident result"),
          })
          .passthrough()
          .optional()
          .describe("Baseline run summary"),
        mitigated: z
          .object({
            peakRetryAmplificationFactor: z.number().nullable().optional().describe("Peak retry amplification factor in the mitigated run"),
            peakErrorRate: z.number().optional().describe("Peak error rate (%) in the mitigated run"),
            peakLatencyP95: z.number().optional().describe("Peak P95 latency (ms) in the mitigated run"),
            totalServedRequests: z.number().optional().describe("Total served requests across all mitigated steps"),
            totalShedRequests: z.number().optional().describe("Total shed requests across all mitigated steps"),
            finalOutcome: z.string().optional().describe("Incident outcome at the last mitigated step: stable | degraded | cascading | protected | recovered"),
            incidentOutcome: z.object({
              rootTrigger: z.object({
                faultIds: z.array(z.string()),
                faultTypes: z.array(z.string()),
                targetResourceIds: z.array(z.string()),
                dependencyIds: z.array(z.string()),
                firstActiveStep: z.number().nullable(),
              }).describe("Scheduled fault or faults that initiated the replayed incident"),
              retryAmplificationFactor: z.number().nullable(),
              peakOriginalRps: z.number(),
              peakAttemptedRps: z.number(),
              peakErrorRate: z.number(),
              affectedDependencyIds: z.array(z.string()),
              protectiveControlsActivated: z.array(z.string()),
              timeToRecoverySteps: z.number().nullable(),
              cascadeContained: z.boolean(),
              runMetadata: z.object({
                seed: z.number(),
                startStep: z.number(),
                endStep: z.number(),
                steps: z.number(),
                trafficRps: z.number(),
                configVersion: z.number(),
                faultIds: z.array(z.string()),
              }).passthrough(),
            }).passthrough().optional().describe("Generic, machine-readable mitigated incident result"),
          })
          .passthrough()
          .optional()
          .describe("Mitigated run summary"),
        delta: z
          .object({
            retryAmplificationFactor: z.number().nullable().optional().describe("Change in peak retry amplification (mitigated − baseline). Negative = improvement."),
            errorRate: z.number().optional().describe("Change in peak error rate in pp (mitigated − baseline). Negative = fewer errors."),
            latencyP95: z.number().optional().describe("Change in peak P95 latency in ms (mitigated − baseline). Negative = lower latency."),
            shedRequests: z.number().optional().describe("Change in total shed requests (mitigated − baseline). Negative = fewer shed requests."),
          })
          .passthrough()
          .optional()
          .describe("Difference (mitigated − baseline). Negative values indicate improvement."),
      })
      .passthrough()
      .describe("Side-by-side resilience comparison result. Inspect each run's incidentOutcome for diagnosis and containment, then use delta.retryAmplificationFactor and delta.errorRate as headline differences."),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (args) => {
    try {
      const { simulationId, ...body } = args;
      const result = await ctx.apiCall(
        "POST",
        `/api/simulations/${simulationId}/resilience/compare`,
        body,
        true
      );
      return structuredResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  }
);
}

export const FULL_TOOL_COUNT = 63;

// ── Anonymous demo tool registration (Streamable HTTP transport) ─────────────

/** Session-state hooks supplied by the HTTP transport (caps, ownership, funnel). */
export interface DemoHooks {
  limits: {
    maxSimulations: number;
    stepLimit: number;
    maxResources: number;
    maxTraffic: number;
  };
  /** True if this session owns the given demo simulation. */
  ownsSim(simulationId: string): Promise<boolean>;
  /** Atomically reserve a sim slot pre-await; false when the cap is reached. */
  reserveSimSlot(): Promise<string | undefined>;
  /** Record a successfully created sim and release its reservation. */
  commitSim(simulationId: string, reservationId: string): Promise<void>;
  /** Release a reservation whose create failed. */
  releaseSimSlot(reservationId: string): Promise<void>;
  /** Atomically reserve a step pre-await; false when the cap is reached. */
  reserveStep(simulationId: string): Promise<boolean>;
  /** Refund a reserved step whose backend call failed. */
  refundStep(simulationId: string): Promise<void>;
  /** Emit a funnel event (mcp_demo_simulation_created, …). */
  onEvent(event: string, toolName: string): void;
  /** Emit the strict allowlisted anonymous create HPA telemetry event. */
  onCreateHpaAudit(audit: CpuHpaAudit): void;
  /**
   * Explicit session-level "current simulation" pointer. Never derived by
   * sorting simulations by creation time. Set on successful create, updated
   * only after an explicit id passes ownership AND the backend call succeeds.
   */
  getCurrentSim(): string | undefined;
  setCurrentSim(simulationId: string): void;
  /**
   * The backend reported this sim gone (404 = deleted/expired): drop it from
   * the session's ownership map and clear the pointer if it matches.
   */
  forgetSim(simulationId: string): void;
}

export const DEMO_GENERIC_SIM_ERROR = "Simulation not found or unavailable for this session";

/**
 * Register the bounded anonymous lifecycle demo set. Lives beside registerTools() so both
 * transports share one registry file, one DEMO_TOOL_NAMES list, and one
 * api.spec payload — they cannot drift. ctx.apiCall must be bound to the
 * session's cwm_ui_session cookie principal so the existing /api/ui/*
 * ownership model applies.
 *
 * @param authenticatedToolCount  Total tool count from registerTools() — used
 *   in descriptions so the number stays accurate when tools are added without
 *   requiring description edits.
 */
export function registerDemoTools(server: McpServer, ctx: ToolContext, demo: DemoHooks, authenticatedToolCount: number): void {
  const { limits } = demo;

  const backendError = (err: unknown) => {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      return structuredResult({
        status: "not_found",
        message:
          "Simulation has expired. Demo simulations expire after a few minutes of inactivity. Call simulation.create to start a new one.",
      });
    }
    if (status === 403) {
      return accessDeniedResult(
        "sim_not_found_or_unauthorized",
        "Simulation not found or does not belong to this session."
      );
    }
    return errorResult((err as Error).message);
  };

  /**
   * Resolve which simulation a per-simulation demo tool should target.
   * Explicit id: must pass the session ownership check (never falls back).
   * Omitted id: use the session's current-simulation pointer; when there is
   * none, return the stable NO_ACTIVE_SIMULATION structured result.
   */
  type ResolvedSim = { simulationId: string; source: "explicit" | "session_default" };
  const resolveSim = async (
    explicitId: string | undefined,
    toolName: string
  ): Promise<ResolvedSim | { result: ReturnType<typeof noActiveSimResult> | ReturnType<typeof accessDeniedResult> }> => {
    if (explicitId !== undefined) {
      if (!await demo.ownsSim(explicitId)) {
        return {
          result: accessDeniedResult(
            "sim_not_found_or_unauthorized",
            "Simulation not found or does not belong to this session."
          ),
        };
      }
      return { simulationId: explicitId, source: "explicit" };
    }
    const current = demo.getCurrentSim();
    if (!current || !await demo.ownsSim(current)) {
      demo.onEvent("mcp_sim_id_fallback_unavailable", toolName);
      return { result: noActiveSimResult() };
    }
    return { simulationId: current, source: "session_default" };
  };

  /** Post-success bookkeeping: pointer update + implicit-resolution telemetry. */
  const onSimOpSuccess = (resolved: ResolvedSim, toolName: string): void => {
    demo.setCurrentSim(resolved.simulationId);
    if (resolved.source === "session_default") {
      demo.onEvent("mcp_sim_id_fallback_used", toolName);
    }
  };

  const handleSimOpError = (err: unknown, simulationId: string) => {
    if ((err as { status?: number }).status === 404) demo.forgetSim(simulationId);
    return backendError(err);
  };

  const SIM_ID_DESCRIBE =
    "Simulation ID returned by simulation.create. Preserve Mcp-Session-Id to omit this field and use the session's current simulation; if your connector starts a fresh MCP session for each call (for example Grok Bot or Cursor), pass this explicit ID after every fresh initialization. A fresh session has no current-simulation pointer and returns NO_ACTIVE_SIMULATION when the ID is omitted. Anonymous capabilities are short-lived (30 minutes by default), unguessable, and revoked when the demo expires or is deleted; proxy IP changes do not invalidate them. Do not treat the ID as a durable share link.";

  server.registerTool(
    "simulation.inject_failure",
    {
      title: "Inject Failure",
      description:
        "Fail one compute/Kubernetes node or database in a temporary anonymous demo simulation (marked critical, not removed). Targeted database quick failures are bounded and reversible; with no serving database at positive load, simulation.step reports 100% errors, zero goodput and errorBreakdown.dbFailure: 100. simulation.recover_resource can restore the database early. An AWS Aurora writer with characteristics.auroraStandbyResourceId pointing to a healthy related replicaOf database has an opt-in modeled failover: the first step is unavailable, the second shows the standby serving without a residual writer-outage penalty. MultiAz or an unrelated second database alone does not establish a standby. Read metrics.databases[].auroraFailover and the promotion event for the failed and standby IDs and success, plus errorRate and throughput. Each quick step is one modeled simulation second, so second-step promotion is one second after injection. Chaos database_crash samples every 10 seconds and defaults to a 30-second promotion and a 1800-second sole-writer restart after its injection duration; compare matching phases, not equal step indices or wall-clock times. These are deterministic assumptions, not observed AWS behavior. No API key required for this temporary anonymous demo operation. " +
        "Exact targeting: pass resourceName (human-readable name, e.g. 'app-server-01'; exact match preferred, an unambiguous prefix is accepted) or resourceId to fail a specific resource — including an individual named instance, not only a group. " +
        "If resourceName matches multiple resources the call fails with a 400 listing every matching candidate by name — retry with one exact name (or its resourceId) from that list. " +
        "The database must be healthy; an already failed database returns a 400 describing its current status. " +
        "When neither parameter is supplied, a RANDOM healthy compute/Kubernetes node is selected (not a database) — this path is non-deterministic and NOT suitable for controlled scenarios or replay; always target by name/id when reproducing a precise fault sequence. " +
        "The response always echoes the applied outcome via resolvedResourceId, resolvedResourceName, and previousHealth (populated from the selected resource on the random path too). " +
        "Network, storage, cache, queue, and security resource types are not supported by quick injection. For typed database_overload use authenticated failure.create (unavailable anonymously); instance_kill PERMANENTLY removes the instance — failure.delete does not restore it; use instance_down instead for a reversible single-node outage. " +
        "Returns the updated resource list and the failure event that was logged. " +
        "The likely next tool is simulation.step to observe how the architecture degrades under failure, then simulation.metrics to review the health impact. " +
        "Do not use it to advance simulation time — that is simulation.step. " +
        "Pass simulationId from simulation.create when this call is made from a fresh MCP session; otherwise you may omit it to target the current simulation in the preserved MCP session. " +
        `Authenticate with an API key to unlock all ${authenticatedToolCount} tools including typed durational failures and chaos engineering.`,
      inputSchema: {
        simulationId: z.string().optional().describe(SIM_ID_DESCRIBE),
        resourceName: z
          .string()
          .optional()
          .describe("Optional: name of the resource to fail (exact match preferred; unambiguous prefix accepted). Ambiguous names return a 400 with a candidate list."),
        resourceId: z
          .string()
          .optional()
          .describe("Optional: ID of the resource to fail. Takes precedence over resourceName."),
      },
      outputSchema: z
        .object({
          resources: z.array(z.record(z.unknown())).optional().describe("Updated resource list after failure injection"),
          event: z.record(z.unknown()).optional().describe("Failure event that was logged"),
          resolvedResourceId: z.string().optional().describe("ID of the resource that was failed (targeted or randomly selected)"),
          resolvedResourceName: z.string().optional().describe("Name of the resource that was failed"),
          previousHealth: z.string().optional().describe("The resource's health status immediately before the failure was applied"),
        })
        .passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      const resolved = await resolveSim(args.simulationId, "simulation.inject_failure");
      if ("result" in resolved) return resolved.result;
      try {
        const body: Record<string, unknown> = {};
        if (args.resourceName !== undefined) body.resourceName = args.resourceName;
        if (args.resourceId !== undefined) body.resourceId = args.resourceId;
        // If no targeting parameters, explicitly opt into random selection
        if (body.resourceName === undefined && body.resourceId === undefined) body.random = true;
        const result = await ctx.apiCall("POST", `/api/ui/simulations/${resolved.simulationId}/inject-failure`, body);
        const resultObj = result !== null && typeof result === "object" ? (result as Record<string, unknown>) : {};
        onSimOpSuccess(resolved, "simulation.inject_failure");
        return structuredResult({
          ...resultObj,
          simulationId: resolved.simulationId,
          simulationIdSource: resolved.source,
          hint: "Authenticated users can target specific resources, run multi-step chaos jobs, and access RL training, AI explain, and multicloud cost comparison tools. Get a key at cloudworldmodel.com.",
        });
      } catch (err) {
        return handleSimOpError(err, resolved.simulationId);
      }
    }
  );

  server.registerTool(
    "simulation.recover_resource",
    {
      title: "Recover Failed Resource",
      description:
        "Recover one reversible failed resource in a temporary anonymous demo simulation. No API key required for this temporary anonymous demo operation. Lower traffic to a serviceable level first, then provide resourceId or resourceName from simulation.create, simulation.step, or simulation.metrics. " +
        "This deactivates applicable instance_down/database_overload failures for only the selected resource and returns recoveryProgress with parked, cooling_down, or healthy state plus cooldown counters. It cannot restore an instance_kill because that failure permanently removes the resource. " +
        "The likely next tool is simulation.step; keep stepping and inspect the targeted resource until recoveryProgress.state is healthy. " +
        "Pass simulationId from simulation.create when using a fresh MCP session; a preserved session may omit it. " +
        `Authenticate with an API key to unlock all ${authenticatedToolCount} tools and unlimited simulations.`,
      inputSchema: {
        simulationId: z.string().optional().describe(SIM_ID_DESCRIBE),
        resourceName: z.string().optional().describe("Exact case-insensitive name of the failed resource to recover"),
        resourceId: z.string().optional().describe("ID of the failed resource to recover"),
      },
      outputSchema: z.object({
        simulationId: z.string().optional(),
        simulationIdSource: z.enum(["explicit", "session_default"]).optional(),
        resolvedResourceId: z.string().optional(),
        resolvedResourceName: z.string().optional(),
        previousHealth: z.string().optional(),
        recoveryState: z.string().optional(),
        stepsToHealthy: z.number().optional(),
        stepsToHealthyIsLowerBound: z.boolean().optional(),
        recoveryProgress: z.object({
          state: z.enum(["parked", "blocked", "cooling_down", "healthy"]),
          parkWindow: z.object({
            totalSteps: z.number(),
            completedSteps: z.number(),
            remainingSteps: z.number(),
          }),
          cooldown: z.object({
            target: z.enum(["warning", "healthy"]).nullable(),
            completedSteps: z.number(),
            requiredSteps: z.number(),
            remainingSteps: z.number(),
          }),
        }).optional(),
        deactivatedFailureIds: z.array(z.string()).optional(),
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      const resolved = await resolveSim(args.simulationId, "simulation.recover_resource");
      if ("result" in resolved) return resolved.result;
      try {
        const body: Record<string, string> = {};
        if (args.resourceName !== undefined) body.resourceName = args.resourceName;
        if (args.resourceId !== undefined) body.resourceId = args.resourceId;
        const result = await ctx.apiCall("POST", `/api/ui/simulations/${resolved.simulationId}/recover-resource`, body);
        onSimOpSuccess(resolved, "simulation.recover_resource");
        const resultObj = result !== null && typeof result === "object" ? result as Record<string, unknown> : {};
        return structuredResult({
          ...resultObj,
          simulationId: resolved.simulationId,
          simulationIdSource: resolved.source,
        });
      } catch (err) {
        return handleSimOpError(err, resolved.simulationId);
      }
    }
  );

  server.registerTool(
    "simulation.delete",
    {
      title: "Delete Simulation",
      description:
        "Permanently delete an owned temporary anonymous demo simulation and its metrics, events, failures, and capability. This is the explicit way to free a simulation slot; deletion is irreversible, while the existing demo TTL remains the safety net for abandoned simulations. " +
        "Prerequisite: a simulationId from simulation.create, or an active simulation in the preserved MCP session. The likely next tool is simulation.create to use the freed slot. " +
        "A successful response is { deleted: true, id }; failed ownership checks do not delete or revoke anything. " +
        `Authenticate with an API key to unlock all ${authenticatedToolCount} tools and persistent simulation management.`,
      inputSchema: {
        simulationId: z.string().optional().describe(SIM_ID_DESCRIBE),
      },
      outputSchema: z.object({
        deleted: z.boolean().optional().describe("True when the simulation was deleted"),
        id: z.string().optional().describe("ID of the deleted simulation"),
        simulationId: z.string().optional().describe("ID used for the deletion"),
        simulationIdSource: z.enum(["explicit", "session_default"]).optional(),
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const resolved = await resolveSim(args.simulationId, "simulation.delete");
      if ("result" in resolved) return resolved.result;
      try {
        await ctx.apiCall("DELETE", `/api/ui/simulations/${resolved.simulationId}`);
        // Only forget/revoke after the backend confirms deletion. This prevents
        // a failed delete from dropping a still-owned simulation or its slot.
        demo.forgetSim(resolved.simulationId);
        demo.onEvent("mcp_demo_simulation_deleted", "simulation.delete");
        return structuredResult({
          deleted: true,
          id: resolved.simulationId,
        });
      } catch (err) {
        return handleSimOpError(err, resolved.simulationId);
      }
    }
  );

  server.registerTool(
    "scenario.list",
    {
      title: "List Scenarios",
      description:
        "List the built-in demo scenarios as compact catalog cards — stable IDs, title/name, description, difficulty, tags, category, duration, provider summary, resource/connection counts, named active/optional traffic phases, and retry-workload disclosure. " +
        "Use it as the first call when you want a ready-made architecture instead of designing one; the cards intentionally omit resource, connection, traffic-pattern, and failure-injection graphs. " +
        `Anonymous discovery includes only scenarios with at most ${limits.maxResources} resources so every listed card is demo-creatable. ` +
        "No prerequisites. Optionally narrow discovery with provider, category, and/or difficulty filters; omit them to receive the complete demo-creatable catalog. Pass a returned id as scenarioId to simulation.create for server-side expansion, or pass it to scenario.get when you need to inspect the full graph. Larger scenarios require an authenticated session. " +
        "Returns named activeFailurePhases and optionalFailurePhases with type, resource/zone target, severity, and step range. No API key required. The likely next tool is scenario.get.",
      inputSchema: scenarioListInputSchema,
      outputSchema: z
        .object({
          scenarios: z
          .array(scenarioCardSchema)
            .describe("Available demo scenarios"),
        })
        .passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", scenarioListPath(args));
        const scenarios = (Array.isArray(result) ? result : [])
          .map(toCompactScenarioCard)
          .filter((scenario) =>
            typeof scenario.resourceCount === "number" && scenario.resourceCount <= limits.maxResources,
          );
        return structuredResult({ scenarios });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );

  server.registerTool(
    "scenario.get",
    {
      title: "Get Scenario",
      description:
        "Hydrate one built-in scenario from the live Cloud World Model scenario library. " +
        "Prerequisite: a scenario id returned by scenario.list. Returns the complete selected scenario graph, including resources and connections plus optional seed, resilienceConfig, protectedResilienceConfig, traffic/failure presets, named traffic-phase summaries, activeFailurePhases and optionalFailurePhases (type, resource/zone target, severity, step range), retry-workload disclosure, and real-world incident metadata. " +
        "The response includes both title and name for compatibility; pass resources and connections, and optionally seed/resilienceConfig, to simulation.create when you need to edit or inspect the graph. For the shorter handoff, pass the id as scenarioId instead. " +
        "The likely next tool is simulation.create.",
      inputSchema: {
        scenarioId: z.string().min(1).describe("Scenario identifier returned by scenario.list"),
      },
      outputSchema: scenarioGetOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/scenarios/${encodeURIComponent(args.scenarioId)}`);
        return structuredResult(hydrateScenario(result));
      } catch (err) {
        if ((err as { status?: number }).status === 404) {
          return structuredResult({
            status: "not_found",
            message: `Scenario '${args.scenarioId}' was not found in the live scenario library.`,
          });
        }
        return errorResult((err as Error).message);
      }
    }
  );

  server.registerTool(
    "simulation.create",
    {
      title: "Create Simulation",
      description:
        `Create a temporary anonymous demo cloud simulation from a list of resources and connections (max ${limits.maxSimulations} active simulations per client, up to ${limits.maxResources} resources; the returned simulationId is a short-lived unguessable capability that survives MCP transport teardown, but it is cleaned up when the demo lifetime expires or the simulation is deleted). No API key required for this temporary anonymous demo operation. ` +
        SCENARIO_CREATE_GUIDANCE +
        "Use resilienceConfig.externalMetrics for deterministic sampled recommendations: no_ready_endpoints is successful zero only when its trigger sets noReadyEndpointsAsZero:true; discovery_error and fetch_error always remain errors. This is not a KEDA/provider actuator and does not change resource counts. " +
        "Use it to start any simulation workflow — either with hydrated resources and connections from scenario.get or your own architecture. Do not use it to modify an existing simulation (use simulation.inject_traffic to change load). For the exact owned typical fit, set appWeight:'typical', location.regionKey:'us-east-2' on all four AWS nodes, one ALB with serviceFamily:'alb' and loadBalancerScheme:'internal', two m5.large compute apps with workload:'crud-typical', appRuntime:'node', appWorkerCount:2, appDbPoolSize:250, one db.r5.large MySQL with workloadDatabaseEngine:'mysql', workloadDatabaseVersion:'8.0', maxConnections:500, ALB→each app→DB connections, minInstances=maxInstances=2, autoscaling:false, traffic 20–300 RPS. Only typical-fit-20, typical-fit-100 and typical-fit-200 tuned the typical-v1-20260927c/6aa574d7ff9d3080b88b221bcd59f7d218ae37f0 fit; 300 is an independent holdout and 500 is diagnostic only. Other typical workloads are modeled, not owned. " +
        "P99 has distinct per-percentile provenance: latencyP99Basis identifies the owned in-VPC internal-ALB fit, a scaled-from-fit estimate (not directly measured), or an uncalibrated generic model. On the exact healthy lean owned graph at 10–1,000 offered target RPS, P99=max(final P95, 7.021919127633514 + 0.00027013891327780484*T) ms; only 10/100/500 RPS were fit, 1,000 RPS was held out. Lean M5 scaling is not a new measurement; typical/heavy and active failures retain uncalibrated P99. predictionEvidence.latencyP99 has measured 0.65–1.35×, scaled 0.50–1.50× (beyond 1,000: 0.25–2×), or uncalibrated 0.50–2× (beyond: 0.25–3×) assumption bounds centered on final P99. These are not confidence intervals or provider measurements. Historical evidence may omit P99. latencyBasis describes the general modeled latency path; use latencyP99Basis specifically for P99. P99 is diagnostic, not scored. " +
         "For compute, set characteristics.capacityRps for an explicit per-node RPS ceiling at which CPU reaches ~95%; do not use maxThroughput for that compute contract. Kubernetes rejects capacityRps: set maxThroughput for the total cluster RPS ceiling, or nodePools[].maxThroughput for per-node pool capacity. Omitted compute capacityRps uses the selected catalog tier and can intentionally produce a stressed baseline (for example, the AWS m5.large catalog denominator is 2,000 RPS); for a healthy, capacity-bounded compute experiment, declare an explicit per-node capacity such as 500 RPS. That value is an experiment control, not a universal hardware fact. " +
         "For OCI flexible compute shapes, pass the documented positive integer characteristics.ocpus explicitly; VM.Standard.E4.Flex accepts 1–64 OCPUs and each OCPU maps to 2 vCPUs. OCPU count establishes capacity dimensions only, not provider-specific performance, throughput, or price. An uncounted flexible shape remains an unverified generic estimate. Check GET /api/prediction/generic-shapes for the catalog-derived generic fallback inventory. " +
         "New prediction-only GCP standard capacity entries include e2-standard-2/4/8/16/32, n1-standard-1/2/4/8/16/32/64/96, and n2-standard-16/32/48/64/80/96/128; provider specifications establish vCPU/memory dimensions, not CWM performance or pricing. Version 1 predictionEvidence explicitly reports legacyGeneric at the top level and on every appCpuByResource item; its note identifies each generic resource's shape and fallback reason. " +
        "For generic fixed compute, characteristics.instanceCount accepts integer 1–100 represented VMs; capacity aggregates and CPU is per VM. Do not combine it with autoscaling:true, minInstances, or maxInstances. Aurora Serverless v2 remains limited to 1 with multiAz:false or 2 with multiAz:true. For Aurora Serverless ACU limits, use characteristics.config.minCapacity/maxCapacity or flat characteristics.minCapacity/maxCapacity. The exact AWS database shape with serviceFamily: 'aurora-serverless' and size: 'db.serverless' also accepts flat characteristics.minAcu/maxAcu; those aliases are rejected elsewhere, including at the resource root or inside config. For that shape, multiAz:true with instanceCount:2 creates a separately billable reader (<writer-id>-reader) in another AZ. Inspect returned resources and metrics before using simulation.step to observe modeled failover; no AWS timing guarantee is implied. " +
         "For database connection budgets, set characteristics.connectionDemand on a database: {mode:'declared',declaredConnections:240} uses that plan-time demand without RPS; {mode:'max',declaredConnections:240,idlePoolFloor:200} takes the maximum of load-derived demand and the declared/floor values; omitted configuration preserves load-derived behavior. declaredConnections and idlePoolFloor are ASSUMPTIONS / plan-time budgets (for example, replicas × per-pod pool size), not observed live DB connections. Set maxConnections to the usable limit you intend to test. Per-database metrics report connectionDemandMode, loadDerivedConnections, declaredConnections/idlePoolFloor, and modeledConnections; cost and DB CPU/latency remain based on existing load-driven behavior. Demand above the usable limit adds a bounded, rule-based pool-saturation error signal; it is not a provider-calibrated rate. " +
        "Capacity, node-bound, SKU, and autoscaling values supplied through this MCP tool are recorded as agent-supplied in the immutable normalizationReceipt; request responseMode: 'full' to inspect it. Generic GKE telemetry and recovery apply only to worker nodes; the control-plane management fee is cost-only, with no modeled control-plane CPU, API throttling, or cooldown. " +
        "To bound the autoscaled fleet size, set the top-level maxInstances / minInstances parameters. If you do not set maxInstances, the engine uses the provider default — AWS 50, GCP 15, Azure/OCI/DigitalOcean 10 — which may be much larger than your intended fleet size. The response includes effectiveMaxInstances / effectiveMinInstances so you can confirm the bounds that will be enforced. " +
        "For a targeted CPU HPA scale-out threshold, send the canonical autoscalingTargetCpu field in this create call (for example, autoscalingTargetCpu: 70 for GKE). The compatible aliases scaleOutCpuThreshold, scaleOutCpuPercent, and autoscaleTargetCpuPercent are also accepted; if more than one is sent, their values must agree. Every create response includes hpaAudit with the supplied field, persisted thresholds, and any provider default. " +
        "For ECS Fargate CPU-only target tracking, set ecsCpuTargetTracking: true, autoscalingTargetCpu, minInstances/maxInstances, and optional scaleOutCooldownSeconds/scaleInCooldownSeconds with simulationSecondsPerStep (default 1). Inspect autoscalingConfig in the compact response or applicationAutoscalingPolicy in the full response. Latency and throughput do not trigger ECS scaling in this mode. " +
        "These four TOP-LEVEL fields are simulation-wide — the engine applies one CPU threshold identically to every resource's scale decision by default. To make ONE resource scale at a different CPU target than the rest of the simulation (e.g. a GKE cluster scaling out at 60% while an EC2 fleet in the same simulation scales out at 80%), set characteristics.scaleOutCpuThreshold and/or characteristics.scaleInCpuThreshold on that specific resource instead — the per-resource value wins over the simulation-wide default for that resource only. A misnamed near-miss field nested under characteristics (e.g. targetCPUUtilizationPercentage) is rejected with a 400 explaining the correct field name — it is never silently dropped and defaulted. " +
      "Responses are compact by default: id, name, status, traffic, and a per-resource summary (id, name, status, cpuPercent, routedRps, availabilityState, isRoutable, and recoveryBlockedReason when provided). Pass responseMode: 'full' to get the complete simulation object instead. During a failure workflow, lower traffic to serviceable levels before calling simulation.recover_resource, then use simulation.step until the recovered resource is healthy. " +
        "Recovery progress is included when applicable: recoveryProgress.state is parked, cooling_down, or healthy, and its parkWindow/cooldown objects report totalSteps, completedSteps, remainingSteps, target, and requiredSteps. Poll simulation.step until state is healthy, then use simulation.metrics to inspect the resulting state and metrics. " +
      "No prerequisites. Returns the created simulation's id, which every other simulation.* tool consumes; the new simulation also becomes this session's current simulation, so subsequent per-simulation tools may omit simulationId. The likely next tool is simulation.step to advance time. " +
        "Do not call api.spec to learn the simulation workflow — the tool descriptions in this session contain everything needed. " +
        "Authenticate with an API key for unlimited persistent simulations.",
      inputSchema: {
        name: z.string().max(120).describe("Human-readable name for the simulation"),
        appWeight: z.enum(["lean", "typical", "heavy"]).optional().describe("Immutable root-level workload weight; defaults to typical with appWeightDefaulted=true. Lean is measured only for the eligible owned graph; heavy is an unsupported assumption. predictionEvidence reports per-quantity provenance and assumption ranges, not confidence intervals."),
        description: z.string().max(500).optional().describe("Optional description of the simulation's purpose"),
        scenarioId: z.string().min(1).optional().describe("Live scenario identifier from scenario.list; mutually exclusive with resources and connections"),
        resources: z
          .array(
            z.object({
              id: z.string().describe("Unique identifier for this resource within the simulation"),
              type: z
                .enum(["compute", "database", "storage", "network", "cache", "queue", "kubernetes"])
                .describe("Resource category"),
              name: z.string().describe("Display name for the resource"),
              // Pass these through for the same explicit HTTP rejection as the
              // authenticated tool; do not silently strip them in the MCP layer.
              minAcu: z.unknown().optional().describe("Not accepted at resource level; use characteristics.minAcu for the exact AWS Aurora Serverless v2 db.serverless shape."),
              maxAcu: z.unknown().optional().describe("Not accepted at resource level; use characteristics.maxAcu for the exact AWS Aurora Serverless v2 db.serverless shape."),
              provider: z
                .enum(["aws", "gcp", "azure", "oci", "digitalocean"])
                .default("aws")
                .describe("Cloud provider hosting this resource"),
              location: z.object({ regionKey: z.string(), zoneKey: z.string().optional(), localityType: z.enum(["az", "zone", "availability_domain", "fault_domain"]).optional(), providerLabel: z.string().optional(), faultDomainKey: z.string().optional() }).optional().describe("Resource region; set location.regionKey:'us-east-2' on each owned typical node (normalized to use2)."),
              recoveryPolicy: z
                .object({
                  criticalCpuThreshold: z.number().min(0).max(100).optional(),
                  criticalSteps: z.number().int().min(1).optional(),
                  warningCpuThreshold: z.number().min(0).max(100).optional(),
                  warningSteps: z.number().int().min(1).optional(),
                  failureParkSteps: z.number().int().min(1).optional(),
                })
                .optional()
                .describe("Optional recovery thresholds and cooldown lengths for this resource"),
              characteristics: z
                .object({
                  size: z.string().optional().describe("Instance or SKU size (e.g. 't3.medium', 'db.r5.large')"),
                  workload: z.enum(["crud", "crud-typical"]).optional().describe("Explicit 'crud-typical' on each owned typical app; 'crud' selects lean identity on the exact lean graph."),
                  appRuntime: z.string().optional().describe("Owned typical app runtime: node."),
                  appWorkerCount: z.number().int().positive().optional().describe("Owned typical: 2 workers on each app."),
                  appDbPoolSize: z.number().int().positive().optional().describe("Owned typical: pool size 250 on each app."),
                  workloadDatabaseEngine: z.enum(["mysql"]).optional().describe("MySQL workload identity on the db.r5.large database."),
                  workloadDatabaseVersion: z.string().optional().describe("Owned typical MySQL workload version: 8.0."),
                  loadBalancerScheme: z.enum(["internal", "internet-facing"]).optional().describe("Owned typical ALB scheme: internal."),
                   ocpus: z.number().int().positive().max(126).optional().describe("OCI flexible compute shape capacity. Family-specific limits are validated against the provider shape; VM.Standard.E4.Flex accepts 1–64 OCPUs and 1 OCPU = 2 vCPUs. Not a performance or price claim."),
                  capacityRps: z
                    .number()
                    .positive()
                    .optional()
                    .describe("Compute only: literal per-node RPS ceiling at which CPU reaches ~95%. Kubernetes rejects capacityRps; use maxThroughput for its total cluster ceiling."),
                  maxThroughput: z
                    .number()
                    .optional()
                    .describe("Kubernetes: total cluster RPS ceiling; compute: legacy internal throughput scaling parameter (prefer capacityRps for compute)."),
                  maxConnections: z.number().int().positive().max(1_000_000).optional().describe("Fixed concurrent DB connection budget; Aurora Serverless defaults from maximum configured ACU."),
                  cdnTraffic: cdnTrafficSchema.optional().describe("Assumed CDN cacheable/dynamic request mix and DB-query fractions. cacheHitRate applies only to the cacheable share. Read simulation.step metrics.cdnFlow for the modeled edge, origin and database flow."),
                  cacheHitRate: z.number().min(0).max(1).optional(),
                  sessionAffinity: sessionAffinitySchema.optional().describe("Opt-in modeled sticky owners for generic compute; Kubernetes requires explicit workload replicas independent of nodes. Use identical fleetId/config on compute peers. Existing sessions do not migrate on scale-out; owner loss disconnects them. reconnect:'next-step' explicitly enables rebinding; default none. Session arrivals/lifetime are assumptions, not measured OpenShell data. Read full step metrics.sessionAffinity for per-owner load, rejects and disconnects."),
                   connectionDemand: z.object({
                     mode: z.enum(["load-derived", "declared", "max"]).describe("load-derived keeps the legacy traffic estimate; declared uses only the plan-time declaredConnections/idlePoolFloor; max uses the greatest of load-derived and declared/floor demand."),
                     declaredConnections: z.number().int().min(0).max(1_000_000).optional().describe("ASSUMPTION / plan-time peak pool budget (for example, replicas × per-pod pool size), not an observed live connection count."),
                     idlePoolFloor: z.number().int().min(0).max(1_000_000).optional().describe("ASSUMPTION / plan-time minimum idle pool footprint, not an observed live connection count."),
                   }).optional().describe("Database only. Omit to preserve legacy load-derived connection use. `declared` and `max` require declaredConnections and/or idlePoolFloor. Demand above usable maxConnections adds a bounded rule-based pool-saturation error signal, not a provider-calibrated rate."),
                  multiAz: z.boolean().optional().describe("AWS Aurora Serverless v2: true with instanceCount:2 creates a billable reader in a second AZ."),
                  instanceCount: z.number().int().min(1).max(100).optional().describe("Generic fixed compute: represented VM count (integer 1–100); capacity aggregates and CPU is per VM. Cannot combine with autoscaling:true, minInstances, or maxInstances. AWS Aurora Serverless v2 remains 1 with multiAz:false or 2 with multiAz:true."),
                  minCapacity: z.number().positive().optional().describe("Aurora Serverless minimum ACU (flat form; nested config wins)."),
                  maxCapacity: z.number().positive().optional().describe("Aurora Serverless maximum ACU (flat form; nested config wins)."),
                  minAcu: z.number().positive().optional().describe("Flat minimum ACU alias only for AWS Aurora Serverless v2 size db.serverless; conflicts with minCapacity are rejected."),
                  maxAcu: z.number().positive().optional().describe("Flat maximum ACU alias only for AWS Aurora Serverless v2 size db.serverless; conflicts with maxCapacity are rejected."),
                  config: z.object({
                    minCapacity: z.number().positive().optional(),
                    maxCapacity: z.number().positive().optional(),
                  }).passthrough().optional().describe("Aurora Serverless ACU bounds. Nested config uses minCapacity/maxCapacity; flat characteristics.minAcu/maxAcu aliases are accepted only on the exact AWS Aurora Serverless v2 db.serverless shape."),
                  autoscaling: z.boolean().optional().describe("Mark this compute resource as the autoscaling primary target"),
                  billingState: z
                    .enum(["active", "idle", "stopped", "detached", "deleted"])
                    .optional()
                    .describe("Billing state: 'stopped' bills storage only, 'idle'/'detached' bill flat idle rates, 'deleted' bills nothing. Default 'active'."),
                  serviceFamily: z
                    .string()
                    .optional()
                    .describe("Idle-billed service family (e.g. 'nat-gateway', 'vpc-endpoint', 'eip-detached', 'ebs-snapshot') — determines the flat idle rate"),
                  capacityGB: z
                    .number()
                    .optional()
                    .describe("Storage capacity in GB — drives per-GB snapshot/backup idle cost and stopped-instance storage cost"),
                  scaleOutCpuThreshold: z
                    .number()
                    .min(0)
                    .max(100)
                    .optional()
                    .describe("Compute or Kubernetes only — overrides the simulation-wide CPU HPA scale-out target (see the top-level autoscalingTargetCpu) for THIS resource's scale decisions only; every other resource keeps the simulation-wide default."),
                  scaleInCpuThreshold: z
                    .number()
                    .min(0)
                    .max(100)
                    .optional()
                    .describe("Compute or Kubernetes only — overrides the simulation-wide CPU HPA scale-in target for THIS resource's scale decisions only; every other resource keeps the simulation-wide default."),
                  kubernetesCpuHpa: kubernetesCpuHpaSchema.optional().describe(
                    "Opt-in bounded workload-pod replica model, separate from node-pool scaling. Declare CPU demand in millicores/RPS and targets (Utilization requires an explicit CPU request). A reviewed cpuDemandCalibration may include 2–100 offered-RPS/aggregate-mCPU points and must match the explicit demand value; cite its source and reference in cpuDemandEvidence. Unannotated request/demand inputs are ASSUMED; no HPA controller parity is claimed.",
                  ),
                })
                .passthrough()
                .optional()
                .describe("Capacity and sizing characteristics for the resource (extra keys such as costMultiplier pass through unchanged)"),
            })
          )
          .optional()
          .describe(`${SCENARIO_RESOURCES_INPUT_DESCRIPTION} (max ${limits.maxResources} in demo mode; mutually exclusive with scenarioId)`),
        connections: z
          .array(
            z.object({
              sourceId: z.string().describe("ID of the source (upstream) resource"),
              targetId: z.string().describe("ID of the target (downstream) resource"),
              label: z.string().optional().describe("Optional label describing the connection type"),
            })
          )
          .optional()
        .describe(`${SCENARIO_CONNECTIONS_INPUT_DESCRIPTION} Directed edges should describe traffic flow between resources; omit when using scenarioId.`),
        traffic: z.number().default(0).describe("Initial traffic in requests per second (RPS)"),
        seed: z.number().int().min(0).optional().describe("Deterministic RNG seed for reproducible replays"),
        maxInstances: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Hard ceiling on the autoscaled compute fleet size, stored as autoscalingConfig.maxInstances. If omitted, the provider default applies (AWS 50, GCP 15, Azure/OCI/DigitalOcean 10) — which may be much larger than your intended fleet size."),
        minInstances: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Floor on the autoscaled compute fleet size, stored as autoscalingConfig.minInstances."),
        autoscalingTargetCpu: z.number().min(0).max(100).optional().describe("Canonical CPU HPA scale-out target percent. CWM synthesizes unrelated autoscaling defaults."),
        scaleOutCpuThreshold: z.number().min(0).max(100).optional().describe("Equivalent alias for autoscalingTargetCpu; if both are sent they must match."),
        scaleOutCpuPercent: z.number().min(0).max(100).optional().describe("Grok-compatible alias for the CPU HPA scale-out target; if multiple target names are sent they must match."),
        autoscaleTargetCpuPercent: z.number().min(0).max(100).optional().describe("Grok-compatible alias for the CPU HPA scale-out target; if multiple target names are sent they must match."),
        ecsCpuTargetTracking: z.boolean().optional().describe("Opt into CPU-only ECS Fargate target tracking."),
        scaleOutCooldownSeconds: z.number().int().min(0).max(86400).optional().describe("ECS CPU target-tracking scale-out cooldown in simulated seconds."),
        scaleInCooldownSeconds: z.number().int().min(0).max(86400).optional().describe("ECS CPU target-tracking scale-in cooldown in simulated seconds."),
        simulationSecondsPerStep: z.number().positive().max(60).optional().describe("Simulated seconds per step for ECS cooldowns (default 1)."),
        resilienceConfig: mcpResilienceConfigSchema.optional().describe("Optional retry/cascade resilience model returned by scenario.get. externalMetrics accepts deterministic sampled triggers; no_ready_endpoints is successful zero only when noReadyEndpointsAsZero:true, while discovery_error and fetch_error remain errors. This recommendation model does not actuate KEDA, providers, or simulated resource counts."),
        responseMode: z
          .enum(["compact", "full"])
          .default("compact")
          .describe(CREATE_RESPONSE_MODE_DESCRIBE),
      },
      outputSchema: createOutputSchema.describe(
        "Compact created-simulation summary by default (id, name, status, traffic, per-resource summary), the complete simulation object with responseMode 'full', or a structured limit response (status: limit_reached) when a demo cap is reached"
      ),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      const hasResources = args.resources !== undefined;
      const hasScenarioId = args.scenarioId !== undefined;
      const hasConnections = args.connections !== undefined;
      if (!hasResources && !hasScenarioId) {
        return errorResult("Provide either resources or scenarioId to create a simulation.");
      }
      if (hasScenarioId && (hasResources || hasConnections)) {
        return errorResult("Do not provide scenarioId with resources or connections; choose one graph source.");
      }

      // Server-side ceilings — never trust schema validation alone. Resolve
      // the live scenario before reserving a slot so over-cap and unknown
      // scenarios do not consume demo quota or reach the UI bridge.
      if (hasResources && args.resources!.length > limits.maxResources) {
        return limitResult(
          "demo_resource_limit_reached",
          `Demo simulations are limited to ${limits.maxResources} resources. Authenticate with an API key to unlock larger architectures, RL training, AI explain, multicloud cost comparison, and chaos engineering jobs.`
        );
      }
      if (hasScenarioId) {
        try {
          const scenario = await ctx.apiCall("GET", `/api/scenarios/${encodeURIComponent(args.scenarioId!)}`);
          const resourceCount = scenario && typeof scenario === "object" && Array.isArray((scenario as Record<string, unknown>).resources)
            ? ((scenario as Record<string, unknown>).resources as unknown[]).length
            : 0;
          if (resourceCount > limits.maxResources) {
            return limitResult(
              "demo_resource_limit_reached",
              `Demo simulations are limited to ${limits.maxResources} resources. Authenticate with an API key to unlock larger architectures, RL training, AI explain, multicloud cost comparison, and chaos engineering jobs.`
            );
          }
        } catch (err) {
          if ((err as { status?: number }).status === 404) {
            return errorResult(`Scenario '${args.scenarioId}' was not found in the live scenario library.`);
          }
          return errorResult((err as Error).message);
        }
      }
      // Reserve the sim slot BEFORE the awaited self-fetch so parallel calls
      // cannot both pass the check and exceed the cap; rollback on failure.
      const reservationId = await demo.reserveSimSlot();
      if (!reservationId) {
        return limitResult(
          "demo_sim_limit_reached",
          `Demo sessions are limited to ${limits.maxSimulations} concurrent simulations. Authenticate with an API key to create more and unlock RL training, AI explain, multicloud cost comparison, and chaos engineering jobs.`
        );
      }
      const traffic = Math.max(0, Math.min(args.traffic ?? 0, limits.maxTraffic));
      try {
        const result = (await ctx.apiCall("POST", "/api/ui/simulations", {
          name: args.name,
          ...(args.appWeight !== undefined ? { appWeight: args.appWeight } : {}),
          description: args.description,
          ...(args.scenarioId !== undefined ? { scenarioId: args.scenarioId } : { resources: args.resources, connections: args.connections ?? [] }),
          ...(args.traffic !== undefined || args.scenarioId === undefined ? { traffic } : {}),
          ...(args.seed !== undefined ? { seed: args.seed } : {}),
          ...(args.maxInstances !== undefined ? { maxInstances: args.maxInstances } : {}),
          ...(args.minInstances !== undefined ? { minInstances: args.minInstances } : {}),
          ...(args.autoscalingTargetCpu !== undefined ? { autoscalingTargetCpu: args.autoscalingTargetCpu } : {}),
          ...(args.scaleOutCpuThreshold !== undefined ? { scaleOutCpuThreshold: args.scaleOutCpuThreshold } : {}),
          ...(args.scaleOutCpuPercent !== undefined ? { scaleOutCpuPercent: args.scaleOutCpuPercent } : {}),
          ...(args.autoscaleTargetCpuPercent !== undefined ? { autoscaleTargetCpuPercent: args.autoscaleTargetCpuPercent } : {}),
          ...(args.ecsCpuTargetTracking !== undefined ? { ecsCpuTargetTracking: args.ecsCpuTargetTracking } : {}),
          ...(args.scaleOutCooldownSeconds !== undefined ? { scaleOutCooldownSeconds: args.scaleOutCooldownSeconds } : {}),
          ...(args.scaleInCooldownSeconds !== undefined ? { scaleInCooldownSeconds: args.scaleInCooldownSeconds } : {}),
          ...(args.simulationSecondsPerStep !== undefined ? { simulationSecondsPerStep: args.simulationSecondsPerStep } : {}),
          ...(args.resilienceConfig !== undefined ? { resilienceConfig: args.resilienceConfig } : {}),
        })) as { id?: string };
        if (result && typeof result.id === "string") {
          await demo.commitSim(result.id, reservationId);
        } else {
          await demo.releaseSimSlot(reservationId);
        }
        demo.onEvent("mcp_demo_simulation_created", "simulation.create");
        const audit = (result as Record<string, unknown>).hpaAudit;
        if (audit && typeof audit === "object" && !Array.isArray(audit)) {
          demo.onCreateHpaAudit(audit as CpuHpaAudit);
        }
        if (args.responseMode === "full") return structuredResult(result);
        return structuredResult(toCompactCreateResponse(result));
      } catch (err) {
        await demo.releaseSimSlot(reservationId);
        return errorResult((err as Error).message);
      }
    }
  );

  server.registerTool(
    "simulation.step",
    {
      title: "Simulate Step",
      description:
        `Advance a temporary anonymous demo simulation by one time step and return updated metrics — CPU, latency, throughput, error rate, cost (max ${limits.stepLimit} persisted steps per demo). ` +
        "Concurrent simulation.step calls on one simulation either serialize as distinct consecutive steps (in the browser Workspace queue) or receive HTTP 409 simulation_step_in_progress without advancing or consuming a demo credit. Wait for the running call to finish, then retry only rejected calls; distinct simulations can run concurrently. After a timeout, inspect simulation.metrics before retrying an uncertain result. " +
        "Use it to observe how the architecture behaves over time, typically right after simulation.create or simulation.inject_traffic. " +
        "Do not use it to read current state without advancing time — that is simulation.metrics. " +
        "Pass the simulationId returned by simulation.create when your connector opens a fresh MCP session; preserve Mcp-Session-Id to use the omitted-ID current-simulation default. The likely next tool is simulation.step again (to keep observing) or simulation.inject_traffic (to change load first). " +
        "Responses are compact by default: principal metrics plus per-resource status (id, name, status, cpuPercent, routedRps, availabilityState, isRoutable, and recoveryBlockedReason when provided) and this step's events. Seeded characteristics.eksSpotInterruption telemetry retains its additive migrationEvaluation beside the interruption lifecycle: use its recorded/derived/unavailable field provenance, frozen deadline verdict/counts/reasons, and simulation-clock milestones rather than final service health. The distinct eksSpotMigration contract remains separately reported when configured. Compact responses also include errorBreakdown when the engine provides it. A critical resource with isRoutable: true is degraded but still serving; unavailable identifies a failed or parked node, while scaled_to_zero and cold_start identify Fargate no-task states. Pass responseMode: 'full' to get the complete simulation state instead. " +
        "During recovery, each resource may include recoveryProgress with state parked, cooling_down, or healthy, plus parkWindow and cooldown counters. Poll simulation.step until the targeted resource's recoveryProgress.state is healthy, then use simulation.metrics to inspect the resulting state and metrics. " +
        "GPU / inference workflow: when the simulation includes a kubernetes resource with characteristics.inferenceMode: true, each step response also includes gpuUtilization (%), tokensPerSecond, costPerMillionTokens (USD/M tokens), idleGpuCostPerHour (USD/hr of standby GPU spend), and idleGpuFraction (0-1 idle HA overhead share) so you can track inference economics step by step. " +
        "Authenticate with an API key for unlimited steps and GPU right-sizing hints.",
      inputSchema: {
        simulationId: z.string().optional().describe(SIM_ID_DESCRIBE),
        responseMode: z
          .enum(["compact", "full"])
          .default("compact")
          .describe(RESPONSE_MODE_DESCRIBE),
      },
      outputSchema: stepOutputSchema.describe(
        "Compact step summary by default (principal metrics + per-resource status), the complete backend step response with responseMode 'full', or a structured limit response (status: limit_reached) when the step cap is reached"
      ),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      const resolved = await resolveSim(args.simulationId, "simulation.step");
      if ("result" in resolved) return resolved.result;
      // Count the step BEFORE the awaited self-fetch so parallel calls cannot
      // all pass the check and exceed the cap; refund on failure.
      if (!await demo.reserveStep(resolved.simulationId)) {
        demo.onEvent("demo_step_limit_reached", "simulation.step");
        return limitResult(
          "demo_step_limit_reached",
          `Demo sessions are limited to ${limits.stepLimit} simulation steps. Authenticate with an API key for unlimited steps, RL training, AI explain, multicloud cost comparison, and chaos engineering jobs.`
        );
      }
      try {
        const result = await ctx.apiCall("POST", `/api/ui/simulations/${resolved.simulationId}/step`, {});
        demo.onEvent("mcp_demo_step_completed", "simulation.step");
        onSimOpSuccess(resolved, "simulation.step");
        const resultObj = result !== null && typeof result === "object" ? (result as Record<string, unknown>) : {};
        const shaped = args.responseMode === "full" ? resultObj : toCompactStepResponse(resultObj);
        return stepResponseResult({
          ...shaped,
          simulationId: resolved.simulationId,
          simulationIdSource: resolved.source,
        }, () => ctx.apiCall("GET", `/api/ui/simulations/${resolved.simulationId}`));
      } catch (err) {
        await demo.refundStep(resolved.simulationId);
        return handleSimOpError(err, resolved.simulationId);
      }
    }
  );

  server.registerTool(
    "simulation.metrics",
    {
      title: "Get Simulation Metrics",
      description:
        "Read the latest metrics and resource states for a temporary anonymous demo simulation: latency, CPU, throughput, error rate, cost per hour, and per-resource health. " +
        "Use it to inspect current state and metrics history without advancing time; do not use it to move the simulation forward — that is simulation.step. " +
        "Responses are compact by default: principal current metrics plus explicit modeled goodputRps (a post-step point rate sourced from throughput, with provenance), goodputWindow (recorded only from persisted simulation-clock bounds, otherwise unavailable with provenance; never derive it from retrieval time or currentStep), errorBreakdown when available, per-resource status (id, name, status, cpuPercent, routedRps, availabilityState, isRoutable, and recoveryBlockedReason when provided), seeded EKS Spot checkpoint history and migrationEvaluationComplete/provenance when present, and the last " +
      `${METRICS_HISTORY_TAIL} metrics-history entries. Pass responseMode: 'full' to get the complete simulation state, normalizedConfig, and full metrics history instead. ` +
        "During recovery, each resource may include recoveryProgress.state (parked, cooling_down, or healthy) with parkWindow and cooldown counters; poll simulation.step until healthy, then use simulation.metrics to inspect the resulting state and metrics. " +
        "GPU / inference workflow: when the simulation includes a kubernetes resource with characteristics.inferenceMode: true, the response also includes top-level gpuUtilization (%), tokensPerSecond, costPerMillionTokens (USD/M tokens), idleGpuCostPerHour (USD/hr of standby GPU spend), and idleGpuFraction (0-1 idle HA overhead share) from the latest step, and each history entry carries the same inference fields. " +
        "Pass the simulationId returned by simulation.create when your connector opens a fresh MCP session; preserve Mcp-Session-Id to use the omitted-ID current-simulation default. A fresh session has no current-simulation pointer. At least one simulation.step is needed for meaningful metrics. " +
        "Read-only; repeated calls may be subject to demo usage limits. The likely next tool is simulation.step or simulation.inject_traffic.",
      inputSchema: {
        simulationId: z.string().optional().describe(SIM_ID_DESCRIBE),
        responseMode: z
          .enum(["compact", "full"])
          .default("compact")
          .describe(METRICS_RESPONSE_MODE_DESCRIBE),
      },
      outputSchema: metricsOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const resolved = await resolveSim(args.simulationId, "simulation.metrics");
      if ("result" in resolved) return resolved.result;
      try {
        const [simulation, rawMetrics] = await Promise.all([
          ctx.apiCall("GET", `/api/ui/simulations/${resolved.simulationId}`),
          ctx.apiCall("GET", `/api/ui/simulations/${resolved.simulationId}/metrics`),
        ]);
        const { metrics, lastCostPerHour } = unwrapMetricsResponse(rawMetrics);
        demo.onEvent("mcp_demo_metrics_viewed", "simulation.metrics");
        onSimOpSuccess(resolved, "simulation.metrics");
        if (args.responseMode === "full") {
          return structuredResult({
            ...toCompactMetricsResponse(simulation, metrics, lastCostPerHour),
            simulation,
            goodputWindow: goodputWindowFromPersistedMetrics(
              resolved.simulationId,
              metrics,
            ),
            metrics: metrics.map((entry) =>
              entry !== null && typeof entry === "object"
                ? addMcpGoodputContract(entry as Record<string, unknown>)
                : entry
            ),
            simulationId: resolved.simulationId,
            simulationIdSource: resolved.source,
            ...(lastCostPerHour !== undefined ? { lastCostPerHour } : {}),
          });
        }
        return structuredResult({
          ...toCompactMetricsResponse(simulation, metrics, lastCostPerHour),
          simulationId: resolved.simulationId,
          simulationIdSource: resolved.source,
        });
      } catch (err) {
        return handleSimOpError(err, resolved.simulationId);
      }
    }
  );

  server.registerTool(
    "simulation.inject_traffic",
    {
      title: "Inject Traffic",
      description:
        `Change the traffic load on a demo simulation. Omit traffic to trigger a random 2×–5× spike (sends random: true internally); provide traffic to set an absolute RPS level (capped at ${limits.maxTraffic} RPS in demo mode). ` +
        "Use it to stress-test the architecture before stepping; the change only affects metrics after the next simulation.step. " +
        "Do not use it to read metrics (simulation.metrics) or advance time (simulation.step). " +
        "Pass the simulationId returned by simulation.create when your connector opens a fresh MCP session; preserve Mcp-Session-Id to use the omitted-ID current-simulation default. Returns the updated simulation with its new traffic level; the likely next tool is simulation.step.",
      inputSchema: {
        simulationId: z.string().optional().describe(SIM_ID_DESCRIBE),
        traffic: z
          .number()
          .optional()
          .describe(`Absolute traffic level in RPS to set. Omit to trigger a random spike instead. Server-capped at ${limits.maxTraffic} RPS in demo mode.`),
      },
      outputSchema: z
        .object({
          id: z.string().optional().describe("Simulation ID"),
          traffic: z.number().optional().describe("New traffic level in RPS after injection"),
          status: z.string().optional().describe("Updated simulation status"),
        })
        .passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      const resolved = await resolveSim(args.simulationId, "simulation.inject_traffic");
      if ("result" in resolved) return resolved.result;
      try {
        let result: unknown;
        if (args.traffic !== undefined) {
          const capped = Math.max(0, Math.min(args.traffic, limits.maxTraffic));
          result = await ctx.apiCall("PATCH", `/api/ui/simulations/${resolved.simulationId}`, { traffic: capped });
        } else {
          result = await ctx.apiCall("POST", `/api/ui/simulations/${resolved.simulationId}/inject-traffic`, { random: true });
        }
        onSimOpSuccess(resolved, "simulation.inject_traffic");
        const resultObj = result !== null && typeof result === "object" ? (result as Record<string, unknown>) : {};
        return structuredResult({
          ...resultObj,
          simulationId: resolved.simulationId,
          simulationIdSource: resolved.source,
        });
      } catch (err) {
        return handleSimOpError(err, resolved.simulationId);
      }
    }
  );
}

/**
 * Output schema shared by the authenticated and demo simulation.step tools.
 * Reflects the compact (default) shape; full mode passes the complete backend
 * JSON through via .passthrough(), and every field is optional so error /
 * limit / full-mode payloads also validate.
 */
const compactFailureTelemetrySchema = {
  failureLifecycle: z
    .enum(["quick_injection_parked", "quick_injection_rejoined", "instance_down", "instance_kill"])
    .optional()
    .describe("Read-only failure lifecycle marker when the backend identifies a quick injection or typed instance failure"),
  routingState: z
    .enum(["unavailable", "serving"])
    .optional()
    .describe("Read-only current routing state for a resource with failure lifecycle telemetry"),
};

/** Explicit seeded EKS evidence shape retained in both compact MCP responses. */
const seededEksFieldProvenanceSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("recorded") }).strict(),
    z.object({
      kind: z.literal("derived"),
      sourceFields: z.array(z.string().min(1)).min(1),
    }).strict(),
    z.object({
      kind: z.literal("unavailable"),
      reason: z.string().min(1),
    }).strict(),
  ]);

const seededEksEvaluationReasonSchema = z
  .object({
    code: z.enum([
      "no_reschedule",
      "scheduling_capacity_exhausted",
      "image_pull_incomplete",
      "startup_incomplete",
      "unclassified_runtime_work_remaining",
    ]),
    workloadCount: z.number().int().nonnegative(),
    pendingWorkloadCount: z.number().int().nonnegative(),
    pullingWorkloadCount: z.number().int().nonnegative(),
    startingWorkloadCount: z.number().int().nonnegative(),
    residualPullSeconds: z.number().nonnegative(),
    residualStartupSeconds: z.number().nonnegative(),
    schedulingCapacity: z.number().int().nonnegative(),
    interruptionHandling: z.enum(["reschedule", "drain-only", "fail-fast"]),
    provenance: z.literal("recorded"),
  })
  .strict();

const seededEksMigrationEvaluationSchema = z
  .object({
    status: z.enum(["not_started", "in_progress", "completed"]),
    interruptionNoticeAtSimulationSeconds: z.number().nonnegative().nullable(),
    deadlineAtSimulationSeconds: z.number().nonnegative().nullable(),
    migrationStartedAtSimulationSeconds: z.number().nonnegative().nullable(),
    allAffectedWorkloadsReadyAtSimulationSeconds: z.number().nonnegative().nullable(),
    migrationDurationSeconds: z.number().nonnegative().nullable(),
    deadlineSeconds: z.literal(120),
    deadlineMet: z.boolean().nullable(),
    affectedWorkloadCount: z.number().int().nonnegative().nullable(),
    readyWorkloadCountAtDeadline: z.number().int().nonnegative().nullable(),
    missedDeadlineWorkloadCount: z.number().int().nonnegative().nullable(),
    evaluatedAtSimulationSeconds: z.number().nonnegative().nullable(),
    limitingReasons: z.array(seededEksEvaluationReasonSchema).max(5),
    fieldProvenance: z.object({
      status: seededEksFieldProvenanceSchema,
      interruptionNoticeAtSimulationSeconds: seededEksFieldProvenanceSchema,
      deadlineAtSimulationSeconds: seededEksFieldProvenanceSchema,
      migrationStartedAtSimulationSeconds: seededEksFieldProvenanceSchema,
      allAffectedWorkloadsReadyAtSimulationSeconds: seededEksFieldProvenanceSchema,
      migrationDurationSeconds: seededEksFieldProvenanceSchema,
      deadlineSeconds: seededEksFieldProvenanceSchema,
      deadlineMet: seededEksFieldProvenanceSchema,
      affectedWorkloadCount: seededEksFieldProvenanceSchema,
      readyWorkloadCountAtDeadline: seededEksFieldProvenanceSchema,
      missedDeadlineWorkloadCount: seededEksFieldProvenanceSchema,
      evaluatedAtSimulationSeconds: seededEksFieldProvenanceSchema,
      limitingReasons: seededEksFieldProvenanceSchema,
    }).strict(),
  })
  .strict()
  .describe(
    "Authoritative additive seeded EKS interruption evaluation. Field values carry recorded/derived/unavailable provenance; deadline verdict/counts/reasons are frozen once status is completed and do not describe later service health.",
  );

const seededEksInterruptionCheckpointEvidenceSchema = z.object({
  engineInputStepIndex: z.number().int().nonnegative(),
  simulationSeconds: z.number().nonnegative(),
  tickDurationSeconds: z.number().positive(),
  pointRateSemantics: z.literal("post_step_point_rate"),
  intervalAttribution: goodputIntervalAttributionSchema.nullable(),
  fieldProvenance: z.object({
    engineInputStepIndex: seededEksFieldProvenanceSchema,
    simulationSeconds: seededEksFieldProvenanceSchema,
    tickDurationSeconds: seededEksFieldProvenanceSchema,
    pointRateSemantics: seededEksFieldProvenanceSchema,
    intervalAttribution: seededEksFieldProvenanceSchema,
  }).strict(),
  trafficFieldProvenance: z.object({
    throughputRps: seededEksFieldProvenanceSchema,
    offeredRps: seededEksFieldProvenanceSchema,
    errorRatePercent: seededEksFieldProvenanceSchema,
    latencyP50Ms: seededEksFieldProvenanceSchema,
  }).strict(),
}).strict().describe(
  "Persisted seeded-EKS checkpoint captured with its interruption JSONB record. engineInputStepIndex is an engine input-step index, simulationSeconds is derived from that index and the recorded tick, and traffic provenance points to outer metric fields rather than duplicating float values.",
);

const seededEksInterruptionTelemetrySchema = z
  .object({
    resourceId: z.string().optional(),
    name: z.string().optional(),
    migrationEvaluation: seededEksMigrationEvaluationSchema.optional(),
    checkpointEvidence: seededEksInterruptionCheckpointEvidenceSchema.optional(),
  })
  .passthrough();

const replayIdentitySchema = z.object({
  scenarioHash: z.string().length(64).describe("Canonical SHA-256 of the persisted scenario graph and attached traffic-pattern order"),
  effectiveConfigHash: z.string().length(64).describe("Original replay-only SHA-256 of the effective six-control startup configuration; top-level effectiveConfigHash is the versioned prediction identity."),
}).strict();
const calibrationEvidenceOutputSchema = z.object({
  kind: z.enum(["owned", "owned-scaled", "modeled"]).describe("owned for the exact AWS CRUD fit; owned-scaled when derived from that fit outside its exact fleet size; modeled when the gate fails or another generic model applies."),
  latencyBasis: z.string().describe("General modeled latency path, such as in-VPC ALB rather than end-to-end; see latencyP99Basis for percentile-specific P99 provenance."),
  latencyP99Basis: z.string().optional().describe("Percentile-specific P99 basis: owned in-VPC internal-ALB fit, scaled from that fit (not directly measured), or uncalibrated generic model."),
  calibrationId: z.string().optional().describe("Versioned owned calibration identifier; present only when that calibration applies."),
  note: z.string().describe("Names the fit scope and limitations. For canonical workload inference, states it is a modeling assumption. For modeled fallback, names all actual failed checks in stable order with resource IDs and safe expected/actual values; never only a generic 'not applied'."),
}).strict();
const auroraFailoverOutputSchema = z.object({
  failedResourceId: z.string(),
  standbyResourceId: z.string(),
  succeeded: z.boolean(),
  phase: z.enum(["promoting", "serving", "unavailable"]),
});

const poolSaturationDetailOutputSchema = z.object({
  resourceId: z.string().describe("Database resource ID whose modeled demand exceeds its usable limit."),
  name: z.string().describe("Human-readable database resource name."),
  cause: z.literal("connection_limit_exceeded").optional()
    .describe("Why this database's modeled connection demand exceeded its usable pool limit."),
  modeledConnections: z.number().nonnegative().describe("Modeled demand/assumption, not observed live sessions."),
  usableConnectionLimit: z.number().nonnegative().describe("This database's effective usable connection limit."),
  demandBasis: z.literal("modeled connection demand; not observed live sessions"),
}).strict();
const databasePressureDetailOutputSchema = z.object({
  resourceId: z.string().describe("Database resource ID contributing to modeled under-limit connection pressure."),
  name: z.string().describe("Human-readable database resource name."),
  cause: z.enum([
    "connection_pressure",
    "cpu_pressure",
    "connection_and_cpu_pressure",
    "provider_reference_fit",
  ]).describe("Modeled source of this database's under-limit pressure contribution."),
  modeledConnections: z.number().nonnegative(),
  usableConnectionLimit: z.number().nonnegative(),
  connectionUtilization: z.number().nonnegative(),
  cpuUtilization: z.number().nonnegative(),
  contributionPct: z.number().nonnegative(),
}).strict();
const errorBreakdownOutputSchema = z.object({
  databasePressure: z.number().optional(),
  benchmarkReferenceFit: z.number().optional(),
  databasePressureDetails: z.array(databasePressureDetailOutputSchema).optional()
    .describe("Per-database causes contributing to pressure below the usable connection limit."),
  poolSaturation: z.number(),
  poolSaturationDetails: z.array(poolSaturationDetailOutputSchema).optional()
    .describe("Per-database pool exhaustion details, including the cause when available. Modeled demand is not observed live sessions."),
  dbFailure: z.number(),
  computeFailure: z.number(),
  capacityOverload: z.number(),
  cpuOverload: z.number(),
  ociStorage: z.number(),
  queueAbsorption: z.number(),
  dependencyFailure: z.number().optional(),
  runtimeMemory: z.number().optional(),
  startupBackpressure: z.number().optional(),
  sessionAffinity: z.number().optional(),
});
const resilienceCapacityAttributionOutputSchema = z.object({
  resourceId: z.string().describe("Logical resource ID used by one or more resilience dependency paths"),
  role: z.enum(["source", "target", "source_and_target"])
    .describe("Whether this resource is a dependency source, target, or both"),
  routableCapacityRps: z.number().finite().nonnegative().nullable()
    .describe("Aggregate capacity available to this logical resource after modeled warm-up and member health; null means no finite capacity ceiling is known"),
  nominalCapacityRps: z.number().finite().nonnegative().nullable().optional()
    .describe("Aggregate capacity before warm-up and member-health reductions; null means no finite capacity ceiling is known"),
  warmupCapacityLossRps: z.number().finite().nonnegative().nullable().optional()
    .describe("Aggregate capacity lost because fleet members are still warming up; zero means no modeled warm-up loss"),
  healthCapacityLossRps: z.number().finite().nonnegative().nullable().optional()
    .describe("Aggregate capacity lost because members are unavailable or degraded; zero means no modeled member-health loss"),
});
const stepOutputSchema = z
  .object({
    simulationId: z.string().optional().describe("ID of the stepped simulation"),
    scenarioHash: z.string().length(64).optional().describe("Canonical SHA-256 of the persisted scenario graph and attached traffic-pattern order"),
    effectiveConfigHash: z.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity; see replayIdentity.effectiveConfigHash for the original replay-only hash."),
    predictionEffectiveConfigHash: z.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity."),
    engineVersion: z.string().optional().describe("Simulation engine version used for this prediction."),
    calibrationEvidence: calibrationEvidenceOutputSchema.optional().describe("Owned-versus-modeled evidence and latency boundary."),
    predictionEvidence: storedPredictionEvidenceSchema.optional(),
    appWeight: z.enum(["lean", "typical", "heavy"]).optional(),
    appWeightDefaulted: z.boolean().optional(),
    replayIdentity: replayIdentitySchema.optional(),
    currentStep: z.number().optional().describe("New simulation time step index"),
    traffic: z.number().optional().describe("Current traffic level in RPS"),
    latencyAvailability: predictionLatencyAvailabilitySchema.optional(),
    latencyP50: z.number().nullable().optional().describe("50th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
    latencyP95: z.number().nullable().optional().describe("95th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
    latencyP99: z.number().nullable().optional().describe("Modeled 99th-percentile latency in ms; null when workload-specific latency evidence is unavailable. Interpret with latencyP99Basis and predictionEvidence.latencyP99."),
    latencyP99Basis: z.string().optional().describe("Percentile-specific P99 basis: owned fit, scaled-from-fit (not directly measured), or uncalibrated generic model."),
    latencyBasis: z.string().optional().describe("General modeled latency path/boundary; see latencyP99Basis for P99-specific provenance."),
    errorRate: z.number().optional().describe("Client-level error rate (%) against original offered RPS. Resilience dependency targets in autoscaled compute fleets use aggregate routable-fleet capacity and health; non-autoscaled targets use their resolved resource capacity, including any declared fixed-instance count."),
    throughput: z.number().optional().describe("Effective requests per second"),
    goodputRps: z.number().optional().describe("Modeled client-level successful requests per second; a post-step point rate sourced from metrics.throughput. Resilience dependency targets in autoscaled compute fleets use aggregate routable-fleet capacity and health; non-autoscaled targets use their resolved resource capacity, including any declared fixed-instance count."),
    goodputSemantics: z.literal("post_step_point_rate").optional().describe("Goodput is a point rate, not an interval total"),
    goodputProvenance: seededEksFieldProvenanceSchema.optional().describe("Provenance for the modeled goodput field"),
    goodputWindow: goodputWindowSchema.optional().describe(
      "Interval goodput aggregate when every point has persisted simulation-clock bounds; otherwise status=unavailable. Never derive this from retrieval time or currentStep.",
    ),
    offeredRps: z.number().optional().describe("Aggregate offered requests per second represented by metrics.offeredRps provenance"),
    modeledShedRps: z.number().optional().describe("Aggregate modeled requests per second shed by bounded capacity"),
    costPerHour: z.number().optional().describe("Estimated cost in USD/hr"),
    residualCostPerHour: z.number().optional().describe("Subtotal of unavailable, parked, or stopped resource costs; healthy/degraded idle resources, including ALBs, are excluded."),
    residualCostDefinition: z.string().optional().describe("Definition of residual cost; total cost remains the complete billed total."),
    requestServing: z.array(z.object({
      resourceId: z.string(),
      activeInstances: z.number().int().nonnegative(),
      desiredTaskCount: z.number().int().nonnegative().optional(),
      provisionedInstances: z.number().int().nonnegative().optional(),
      drainingTasks: z.number().int().nonnegative().optional()
        .describe("Excess running Fargate tasks still serving and billing during scale-down."),
      aggregateCapacityRps: z.number().nonnegative().optional()
        .describe("Capacity includes active tasks, including tasks draining during scale-down."),
      scalingState: z.string(),
    }).passthrough()).optional(),
    metricId: z.string().optional().describe("Storage-assigned persisted metric ID when available"),
    loadBalancers: z
      .array(
        z.object({
          resourceId: z.string().optional().describe("ID of the load balancer"),
          routedRps: z.number().optional().describe("Requests per second routed through this load balancer this step"),
        }).passthrough(),
      )
      .optional()
      .describe("Per-load-balancer routed traffic, including CDN-origin-matched ALB RPS for comparison with cdnFlow.originRps"),
    eksSpotInterruptions: z
      .array(seededEksInterruptionTelemetrySchema)
      .optional()
      .describe("Seeded EKS interruption telemetry, including the authoritative additive migrationEvaluation when recorded."),
    metrics: z
      .object({
        latencyP50: z.number().nullable().optional().describe("50th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
        latencyP95: z.number().nullable().optional().describe("95th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
        latencyP99: z.number().nullable().optional().describe("Modeled 99th-percentile latency in ms; null when workload-specific latency evidence is unavailable. Interpret with this metric's latencyP99Basis and predictionEvidence.latencyP99."),
        latencyP99Basis: z.string().optional().describe("Percentile-specific P99 basis for this metric checkpoint."),
        latencyBasis: z.string().optional().describe("General modeled latency path/boundary; see latencyP99Basis for P99-specific provenance."),
        eksSpotInterruptions: z.array(seededEksInterruptionTelemetrySchema).optional(),
        errorBreakdown: errorBreakdownOutputSchema.optional()
          .describe("Full-mode error contributors, including cause-attributed pool-saturation details."),
      })
      .passthrough()
      .optional()
      .describe("Full-mode backend metric record; migrationEvaluation is exact-typed when a seeded interruption is present."),
    resources: z
      .array(
        z
          .object({
            id: z.string().optional().describe("Resource ID"),
            name: z.string().optional().describe("Resource display name"),
            status: z.string().optional().describe("Health status (healthy/warning/critical/failed)"),
            cpuPercent: z.number().optional().describe("CPU utilization (%)"),
            routedRps: z.number().optional().describe("Requests per second routed to this resource this step (compute/kubernetes only)"),
            availabilityState: z
              .enum(["available", "degraded", "unavailable", "scaled_to_zero", "cold_start"])
              .optional()
              .describe("Availability derived from lifecycle and routed traffic: available = serving normally, degraded = critical/warning but still serving, unavailable = failed/parked, scaled_to_zero and cold_start = Fargate no-task states"),
            isRoutable: z
              .boolean()
              .optional()
              .describe("Whether this compute/Kubernetes resource can receive traffic in this step; false distinguishes a failed/parked node from a critical node still serving"),
            recoveryBlockedReason: z
              .string()
              .optional()
              .describe("Engine recovery guard currently preventing cooldown progress, when present (for example failure_park_window or idle_cpu_floor)"),
            recoveryProgress: z
              .object({
                state: z.enum(["parked", "blocked", "cooling_down", "healthy"]),
                parkWindow: z.object({
                  totalSteps: z.number(),
                  completedSteps: z.number(),
                  remainingSteps: z.number(),
                }),
                cooldown: z.object({
                  target: z.enum(["warning", "healthy"]).nullable(),
                  completedSteps: z.number(),
                  requiredSteps: z.number(),
                  remainingSteps: z.number(),
                }),
              })
              .optional()
              .describe("Read-only recovery progress; poll simulation.step until state is healthy, then use simulation.metrics to inspect the result"),
            ...compactFailureTelemetrySchema,
          })
          .passthrough()
      )
      .optional()
      .describe("Per-resource status summary (compact mode)"),
    events: z.array(z.object({
      type: z.string().min(1).describe("Canonical event type"),
    }).passthrough()).optional().describe("Events generated during this step; every event has a non-empty canonical type"),
    kubernetesCpuHpa: z.array(kubernetesCpuHpaTelemetrySchema).optional().describe(
      "Per-workload CPU request, observed millicores per pod, target calculations, bounded replica recommendation, scale-down stabilization, and provenance/errors. Utilization without a CPU request has no recommendation; this is not Kubernetes controller parity.",
    ),
    errorBreakdown: errorBreakdownOutputSchema
      .optional()
      .describe("Validated additive error contributors in percentage-point units; separates database connection pressure below the usable pool limit from pool saturation after exhaustion, plus DB, compute, capacity, CPU, storage, runtime-memory, and queue absorption effects"),
    auroraFailovers: z.array(auroraFailoverOutputSchema).optional()
      .describe("Compact per-writer Aurora failover state; promoting has no serving writer, serving means the explicitly related standby took over."),
    // GPU / inference metrics — present only when the simulation has a GPU
    // kubernetes resource with inferenceMode: true; absent otherwise.
    gpuUtilization: z.number().optional().describe("GPU utilization (%) — present only on simulations with a GPU inference kubernetes resource"),
    tokensPerSecond: z.number().optional().describe("Inference throughput in tokens/second — present only on GPU inference simulations"),
    costPerMillionTokens: z.number().nullable().optional().describe("Self-hosted inference cost in USD per million tokens (null when no tokens are being processed) — present only on GPU inference simulations"),
    idleGpuCostPerHour: z.number().optional().describe("USD/hr of GPU spend funding idle/standby capacity (HA overhead) — present only on GPU inference simulations"),
    idleGpuFraction: z.number().optional().describe("Share (0-1) of the GPU bill that is idle/standby capacity — present only on GPU inference simulations; values above 0.5 mean over half the GPU spend is HA overhead"),
    // Resilience telemetry — present only when resilienceConfig.enabled is true.
    retryAmplificationFactor: z.number().nullable().optional().describe("(Original offered RPS + generated retry RPS) / original offered RPS; an amplification measure, not capacity or goodput. Values > 1.0 = amplification risk. null = model ran but no traffic. Absent = resilience model disabled."),
    externalMetrics: externalMetricsTelemetrySchema.optional().describe(
      "Latest deterministic external-metric recommendation telemetry, including each trigger's sample status/outcome/value/desired capacity and the combined capacity decision. It never actuates simulated or provider resources.",
    ),
    resilienceDiagnostics: z
      .object({
        incidentOutcome: z.string().optional().describe("Incident outcome: stable | degraded | cascading | protected | recovered"),
        pathCount: z.number().optional().describe("Number of dependency paths evaluated this step"),
        bounded: z.boolean().optional().describe("True when a generated-traffic, traversal-work, or cascade-depth bound truncated model work"),
        capacityByResource: z.array(resilienceCapacityAttributionOutputSchema).optional()
          .describe("Unique logical dependency resources; each appears once even when several paths reference it. When values are finite, nominalCapacityRps minus warmupCapacityLossRps (members still warming) and healthCapacityLossRps (unavailable or degraded members) equals routableCapacityRps, within rounding."),
      })
      .passthrough()
      .optional()
      .describe("Bounded resilience diagnostics summary (compact mode). Absent when the resilience model did not run. Use simulation.compare_resilience for full per-path detail."),
  })
  .passthrough()
  .describe(
    "Compact step summary by default (principal metrics + per-resource status). With responseMode 'full', the complete backend step response (simulation, metrics, events) is passed through instead."
  );

/**
 * Output schema shared by the authenticated and demo simulation.metrics tools.
 * Reflects the compact (default) shape; full mode passes the complete backend
 * payload (simulation + full metrics history) through via .passthrough(), and
 * every field is optional so error / not_found / full-mode payloads validate.
 */
const metricsOutputSchema = z
  .object({
    simulationId: z.string().optional().describe("ID of the queried simulation"),
    scenarioHash: z.string().length(64).optional().describe("Canonical replay scenario graph hash."),
    effectiveConfigHash: z.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity."),
    replayIdentity: replayIdentitySchema.optional(),
    engineVersion: z.string().optional().describe("Simulation engine version used for this prediction."),
    predictionEffectiveConfigHash: z.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity."),
    calibrationEvidence: calibrationEvidenceOutputSchema.optional().describe("Owned-versus-modeled evidence and latency boundary."),
    predictionEvidence: storedPredictionEvidenceSchema.optional(),
    appWeight: z.enum(["lean", "typical", "heavy"]).optional(),
    appWeightDefaulted: z.boolean().optional(),
    currentStep: z.number().optional().describe("Current simulation time step"),
    traffic: z.number().optional().describe("Current traffic level in RPS"),
    latencyAvailability: predictionLatencyAvailabilitySchema.optional(),
    latencyP50: z.number().nullable().optional().describe("Latest 50th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
    latencyP95: z.number().nullable().optional().describe("Latest 95th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
    latencyP99: z.number().nullable().optional().describe("Latest modeled 99th-percentile latency in ms; null when workload-specific latency evidence is unavailable. Interpret with latencyP99Basis and predictionEvidence.latencyP99."),
    latencyP99Basis: z.string().optional().describe("Latest percentile-specific P99 basis: owned fit, scaled-from-fit (not directly measured), or uncalibrated generic model."),
    latencyBasis: z.string().optional().describe("Latest general modeled latency path/boundary; see latencyP99Basis for P99-specific provenance."),
    errorRate: z.number().optional().describe("Latest client-level error rate (%) against original offered RPS. Resilience dependency targets in autoscaled compute fleets use aggregate routable-fleet capacity and health; non-autoscaled targets use their resolved resource capacity, including any declared fixed-instance count."),
    throughput: z.number().optional().describe("Latest effective requests per second"),
    goodputRps: z.number().optional().describe("Modeled client-level successful requests per second; a post-step point rate sourced from metrics.throughput. Resilience dependency targets in autoscaled compute fleets use aggregate routable-fleet capacity and health; non-autoscaled targets use their resolved resource capacity, including any declared fixed-instance count."),
    goodputSemantics: z.literal("post_step_point_rate").optional().describe("Goodput is a point rate, not an interval total"),
    goodputProvenance: seededEksFieldProvenanceSchema.optional().describe("Provenance for the modeled goodput field"),
    goodputWindow: goodputWindowSchema.optional().describe(
      "Interval goodput aggregate when every point has persisted simulation-clock bounds; otherwise status=unavailable. Never derive this from retrieval time or currentStep.",
    ),
    offeredRps: z.number().optional().describe("Latest aggregate offered requests per second"),
    modeledShedRps: z.number().optional().describe("Latest aggregate modeled shed requests per second"),
    costPerHour: z.number().optional().describe("Latest estimated cost in USD/hr"),
    residualCostPerHour: z.number().optional().describe("Subtotal of unavailable, parked, or stopped resource costs; healthy/degraded idle resources, including ALBs, are excluded."),
    residualCostDefinition: z.string().optional().describe("Definition of residual cost; total cost remains the complete billed total."),
    metricId: z.string().optional().describe("Storage-assigned ID of the latest persisted metric"),
    kubernetesCpuHpa: z.array(kubernetesCpuHpaTelemetrySchema).optional().describe(
      "Latest per-workload bounded CPU HPA telemetry, including input provenance and missing-request errors; no Kubernetes controller parity is claimed.",
    ),
    eksSpotInterruptions: z
      .array(seededEksInterruptionTelemetrySchema)
      .optional()
      .describe("Latest seeded EKS interruption telemetry, including additive migrationEvaluation/provenance when recorded."),
    resources: z
      .array(
        z
          .object({
            id: z.string().optional().describe("Resource ID"),
            name: z.string().optional().describe("Resource display name"),
            status: z.string().optional().describe("Health status (healthy/warning/critical/failed)"),
            cpuPercent: z.number().optional().describe("CPU utilization (%)"),
            routedRps: z.number().optional().describe("Requests per second routed to this resource (compute/kubernetes only)"),
            availabilityState: z
              .enum(["available", "degraded", "unavailable", "scaled_to_zero", "cold_start"])
              .optional()
              .describe("Availability derived from lifecycle and routed traffic: available = serving normally, degraded = critical/warning but still serving, unavailable = failed/parked, scaled_to_zero and cold_start = Fargate no-task states"),
            isRoutable: z
              .boolean()
              .optional()
              .describe("Whether this compute/Kubernetes resource can receive traffic in this step; false distinguishes a failed/parked node from a critical node still serving"),
            recoveryBlockedReason: z
              .string()
              .optional()
              .describe("Engine recovery guard currently preventing cooldown progress, when present (for example failure_park_window or idle_cpu_floor)"),
            recoveryProgress: z
              .object({
                state: z.enum(["parked", "blocked", "cooling_down", "healthy"]),
                parkWindow: z.object({
                  totalSteps: z.number(),
                  completedSteps: z.number(),
                  remainingSteps: z.number(),
                }),
                cooldown: z.object({
                  target: z.enum(["warning", "healthy"]).nullable(),
                  completedSteps: z.number(),
                  requiredSteps: z.number(),
                  remainingSteps: z.number(),
                }),
              })
              .optional()
              .describe("Read-only recovery progress; poll simulation.step until state is healthy, then use simulation.metrics to inspect the result"),
             ...compactFailureTelemetrySchema,
          })
          .passthrough()
      )
      .optional()
      .describe("Per-resource status summary (compact mode)"),
    errorBreakdown: errorBreakdownOutputSchema
      .optional()
      .describe("Validated additive error contributors from the latest metrics entry, in percentage-point units; distinguishes database connection pressure below the usable limit from pool saturation after exhaustion"),
    auroraFailovers: z.array(auroraFailoverOutputSchema).optional()
      .describe("Latest compact per-writer Aurora failover state, with failed and standby IDs and phase."),
    metricsHistoryLength: z
      .number()
      .optional()
      .describe(`Total number of metrics-history entries (compact mode returns only the last ${METRICS_HISTORY_TAIL})`),
    // GPU / inference metrics at the top level — present only when the simulation
    // has a GPU kubernetes resource with inferenceMode: true; absent otherwise.
    gpuUtilization: z.number().optional().describe("Latest GPU utilization (%) — present only on GPU inference simulations"),
    tokensPerSecond: z.number().optional().describe("Latest inference throughput in tokens/second — present only on GPU inference simulations"),
    costPerMillionTokens: z.number().nullable().optional().describe("Latest self-hosted inference cost in USD per million tokens (null when no tokens are being processed) — present only on GPU inference simulations"),
    idleGpuCostPerHour: z.number().optional().describe("Latest USD/hr of GPU spend funding idle/standby capacity (HA overhead) — present only on GPU inference simulations"),
    idleGpuFraction: z.number().optional().describe("Latest share (0-1) of the GPU bill that is idle/standby capacity — present only on GPU inference simulations"),
    // Resilience telemetry from the latest step — present only when the resilience model ran.
    retryAmplificationFactor: z.number().nullable().optional().describe("Latest (original offered RPS + generated retry RPS) / original offered RPS; an amplification measure, not capacity or goodput. Values > 1.0 = amplification risk. null = model ran but no traffic. Absent = resilience model disabled."),
    externalMetrics: externalMetricsTelemetrySchema.optional().describe(
      "Latest deterministic external-metric recommendation telemetry, including each trigger's sample status/outcome/value/desired capacity and the combined capacity decision. It never actuates simulated or provider resources.",
    ),
    resilienceDiagnostics: z
      .object({
        incidentOutcome: z.string().optional().describe("Latest incident outcome: stable | degraded | cascading | protected | recovered"),
        pathCount: z.number().optional().describe("Number of dependency paths evaluated in the latest step"),
        bounded: z.boolean().optional().describe("True when a generated-traffic, traversal-work, or cascade-depth bound truncated model work"),
        capacityByResource: z.array(resilienceCapacityAttributionOutputSchema).optional()
          .describe("Unique logical dependency resources in the latest step; each appears once even when several paths reference it. When values are finite, nominalCapacityRps minus warmupCapacityLossRps (members still warming) and healthCapacityLossRps (unavailable or degraded members) equals routableCapacityRps, within rounding."),
      })
      .passthrough()
      .optional()
      .describe("Bounded resilience diagnostics from the latest step (compact mode). Absent when the resilience model did not run."),
    metrics: z
      .array(
        z
          .object({
            metricId: z.string().optional().describe("Storage-assigned persisted metric ID, when this history entry was stored"),
            latencyAvailability: predictionLatencyAvailabilitySchema.optional(),
            latencyP50: z.number().nullable().optional().describe("Median latency in ms; null when workload-specific latency evidence is unavailable."),
            latencyP95: z.number().nullable().optional().describe("95th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
            latencyP99: z.number().nullable().optional().describe("Modeled 99th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
            latencyP99Basis: z.string().optional().describe("Percentile-specific P99 basis for this history record."),
            latencyBasis: z.string().optional().describe("General modeled latency path/boundary; see latencyP99Basis for P99-specific provenance."),
            cpuUsage: z.number().optional().describe("CPU utilization (%)"),
            throughput: z.number().optional().describe("Effective RPS"),
            errorRate: z.number().optional().describe("Client-level error rate (%) against original offered RPS. Resilience dependency targets in autoscaled compute fleets use aggregate routable-fleet capacity and health; standalone targets count once."),
            costPerHour: z.number().optional().describe("Estimated cost in USD/hr"),
            eksSpotInterruptions: z.array(seededEksInterruptionTelemetrySchema).optional(),
            // GPU / inference fields in history entries — present only on GPU inference simulations.
            gpuUtilization: z.number().optional().describe("GPU utilization (%) for this step — present only on GPU inference simulations"),
            tokensPerSecond: z.number().optional().describe("Inference throughput in tokens/second for this step — present only on GPU inference simulations"),
            costPerMillionTokens: z.number().nullable().optional().describe("Self-hosted inference cost in USD per million tokens for this step — present only on GPU inference simulations"),
            errorBreakdown: errorBreakdownOutputSchema
              .optional()
              .describe("Validated additive error contributors for this history entry"),
            // Resilience fields in history entries — present only when the resilience model ran for that step.
            retryAmplificationFactor: z.number().nullable().optional().describe("Per-step (original offered RPS + generated retry RPS) / original offered RPS — present only when resilience is enabled; an amplification measure, not capacity or goodput."),
            resilience: z.object({
              externalMetrics: externalMetricsTelemetrySchema.optional(),
            }).passthrough().optional().describe("Per-step resilience telemetry, including external-metric trigger outcomes when configured."),
          })
          .passthrough()
      )
      .optional()
      .describe(`Metrics history — bounded to the last ${METRICS_HISTORY_TAIL} entries in compact mode, full history in full mode`),
    simulation: z
      .object({
        id: z.string().optional().describe("Simulation ID"),
        name: z.string().optional().describe("Simulation name"),
        currentTime: z.number().optional().describe("Current time step"),
        traffic: z.number().optional().describe("Current RPS"),
        resources: z.array(z.record(z.unknown())).optional().describe("Resource states with health and status"),
      })
      .passthrough()
      .optional()
      .describe("Complete simulation state (full mode only; absent in compact mode and when status is not_found/access_denied)"),
  })
  .passthrough()
  .describe(
    "Compact metrics summary by default (principal current metrics, per-resource status, bounded history tail). With responseMode 'full', the complete simulation object and full metrics history are passed through instead."
  );

const METRICS_RESPONSE_MODE_DESCRIBE =
  `Response detail level. 'compact' (default) returns principal current metrics, errorBreakdown when available, per-resource status (id, name, status, cpuPercent, routedRps, availabilityState, isRoutable, recoveryBlockedReason, and failureLifecycle/routingState when provided), and only the last ${METRICS_HISTORY_TAIL} metrics-history entries — keeps polling cheap for agent loops. 'full' returns the complete simulation object (all resource characteristics and connections) plus the entire metrics history.`;

/**
 * Shared schema fragment for the normalizedConfig block returned by
 * simulation.create (compact mode) and simulation.get. All fields are optional
 * per the MCP structured-output contract so error / not_found / full-mode
 * payloads pass validation even when normalizedConfig is absent.
 */
const normalizedConfigSchema = z
  .object({
    resources: z
      .array(
        z
          .object({
            id: z.string().optional().describe("Resource ID"),
            name: z.string().optional().describe("Resource display name"),
            type: z.string().optional().describe("Resource type (compute, database, kubernetes, …)"),
            provider: z.string().optional().describe("Cloud provider"),
            // Multiplier-billed resources (compute, database, network, cache, queue, storage).
            resolvedCostMultiplier: z
              .number()
              .optional()
              .describe("Effective cost multiplier the engine applies to the base provider rate for this resource"),
            resolvedHourlyRate: z
              .number()
              .optional()
              .describe("Resolved hourly billing rate in USD/hr (base rate × multiplier)"),
            rateProvenance: z
              .object({
                basis: z
                  .enum(["on-demand", "spot", "estimated"])
                  .describe("Pricing basis: published on-demand list price, spot, or a flat estimate"),
                resolution: z
                  .enum(RATE_PROVENANCE_RESOLUTIONS)
                  .describe("Which lookup path resolved the rate"),
                lastVerified: z
                  .string()
                  .nullable()
                  .describe("ISO-8601 date the constant was last cross-checked against the provider's pricing page; null when unknown"),
                region: z
                  .string()
                  .nullable()
                  .describe("Region the verified rate applies to; null for region-uniform pricing"),
                sku: z.string().optional().describe("Exact catalog SKU used for this rate, when available"),
                source: z.string().optional().describe("Official pricing source URL, when verified"),
                architecture: z.string().optional().describe("Fargate task architecture when architecture-specific billing applies"),
              })
              .optional()
              .describe(
                "Trust metadata for the resolved rate: pricing basis (on-demand/spot/estimated), lookup path, " +
                "and the date the constant was last verified against the provider's public pricing page. " +
                "Present on compute, database, and GPU inference resources; absent on resource types where no rate is resolved."
              ),
            // Capacity.
            resolvedMaxThroughputRps: z
              .number()
              .optional()
              .describe("Per-node RPS ceiling the engine uses for load and autoscale calculations"),
            requestServing: z.object({
              serviceFamily: z.string().optional(),
              desiredTaskCount: z.number().int().nonnegative().optional(),
              minTaskCount: z.number().int().nonnegative().optional(),
              maxTaskCount: z.number().int().positive().optional(),
              perTaskCapacityRps: z.number().positive().optional(),
              perTaskCapacityEvidence: z.object({
                basis: z.enum(["assumption", "documented", "measured", "catalog"]),
                origin: z.enum(["caller-provided", "fargate-size-heuristic", "policy-default", "provider-catalog"]),
                source: z.string().optional(),
              }).optional(),
              aggregateCapacityRps: z.number().nonnegative().optional(),
              maxAggregateCapacityRps: z.number().nonnegative().optional(),
            }).passthrough().optional().describe(
              "Resolved request-serving settings. For Fargate, aggregateCapacityRps is desiredTaskCount × this service's own rate, maxAggregateCapacityRps uses maxTaskCount, and perTaskCapacityEvidence distinguishes assumptions from caller-asserted documentation/measurement or provider catalog data."
            ),
            capacityProvenance: z
              .enum(["absent", "capacityRps", "explicit_maxThroughput", "explicit_requestsPerSecond", "provider_catalog", "generic_fallback"])
              .optional()
              .describe("Source of the effective compute capacity: explicit caller field, provider catalog, or generic fallback"),
            effectiveCpuCapacityRps: z
              .number()
              .optional()
              .describe("CPU-curve denominator after applying the provider threshold to explicit capacityRps"),
            // Kubernetes single-pool fields.
            nodeCount: z.number().optional().describe("Current node count"),
            minNodes: z.number().optional().describe("Autoscale floor (scale-in stops here)"),
            maxNodes: z.number().optional().describe("Autoscale ceiling (scale-out stops here)"),
            perNodeRatePerHour: z
              .number()
              .optional()
              .describe("Per-node billing rate in USD/hr"),
            controlPlaneFeePerHour: z
              .number()
              .optional()
              .describe("Cost-only cluster management fee in USD/hr; it does not represent control-plane CPU, throttling, or recovery telemetry"),
            spotFactor: z
              .number()
              .optional()
              .describe("Spot-instance discount factor applied to the node cost (absent = 1, i.e. no discount)"),
            currentNodesCostPerHour: z
              .number()
              .optional()
              .describe("Total cluster cost at the current node count (control plane + nodes × rate) × spotFactor in USD/hr"),
            billingFloorNodes: z
              .number()
              .optional()
              .describe("Minimum node count the engine will ever bill — scale-in cannot go below this"),
            billingFloorCostPerHour: z
              .number()
              .optional()
              .describe("Minimum cluster cost in USD/hr (cost at billingFloorNodes)"),
            autoscaleThreshold: z
              .object({
                scaleOutCpuPercent: z
                  .number()
                  .describe("CPU % that triggers a scale-out event"),
                scaleInCpuPercent: z
                  .number()
                  .describe("CPU % below which a scale-in event fires"),
              })
              .optional()
              .describe("Effective autoscale thresholds (provider profile merged with any explicit config)"),
            // Kubernetes multi-pool field.
            nodePools: z
              .array(
                z
                  .object({
                    name: z.string().optional(),
                    nodeCount: z.number(),
                    minNodes: z.number(),
                    maxNodes: z.number(),
                    perNodeRatePerHour: z.number(),
                    perNodeMaxThroughputRps: z.number().optional(),
                  })
                  .passthrough()
              )
              .optional()
              .describe("Per-pool billing details for multi-pool clusters (absent on single-pool clusters)"),
            // GPU / inference fields (present only on kubernetes resources with inferenceMode: true).
            resolvedGpuRatePerNode: z
              .number()
              .optional()
              .describe("Resolved GPU node billing rate in USD/hr — present only on inference-mode kubernetes resources"),
            resolvedSkuLabel: z
              .string()
              .optional()
              .describe("The GPU SKU that was matched (e.g. 'a100-80gb') or a fallback label naming the provider default — present only on inference-mode kubernetes resources"),
            perNodeTokensPerSec: z
              .number()
              .optional()
              .describe("Modelled per-node token throughput at full utilisation (tokens/sec) — present only on inference-mode kubernetes resources"),
            // Database fields.
            resolvedStorageTier: z
              .string()
              .optional()
              .describe("Storage tier / size string used to resolve pricing (database resources)"),
            resolvedConnectionLimit: z
              .number()
              .optional()
              .describe("Effective max-connection limit the engine uses for connection-pressure modelling (database resources)"),
            // behaviorModel — latency simulation path + GPU interconnect topology factors.
            // Present on all resource types; topology fields only populated on inferenceMode K8s clusters.
            behaviorModel: z
              .object({
                latencyPath: z
                  .string()
                  .optional()
                  .describe(
                    "Canonical latency simulation path identifier, e.g. 'gpu-inference/ttft-decode' or 'generic-kubernetes/load-saturation'. " +
                    "Machine-match against LATENCY_PATHS constants — do not string-parse."
                  ),
                description: z
                  .string()
                  .optional()
                  .describe("Human-readable description of the latency model applied to this resource"),
                modelingNote: z
                  .string()
                  .optional()
                  .describe(
                    "Provenance disclaimer for latency figures. On inferenceMode clusters states that TTFT/P95/P99 are " +
                    "CWM simulation-model estimates from accelerator catalog parameters, not externally measured benchmarks. " +
                    "When topology is omitted also notes the legacy-baseline assumption (topologyThroughputFactor=1.0)."
                  ),
                acceleratorResolution: z
                  .enum(["catalog", "fallback"])
                  .optional()
                  .describe(
                    "'catalog' = accelerator matched ACCELERATOR_TOKENS_PER_SEC; " +
                    "'fallback' = unrecognised, defaults substituted (TTFT 600 ms, decode 700 tok/s, perNodeTokens 500)"
                  ),
                behaviourFidelity: z
                  .enum(["modeled", "estimated"])
                  .optional()
                  .describe("'modeled' = parameters from the performance catalog; 'estimated' = defaults substituted"),
                // Topology latency fields (resolveTopologyLatencyFactors) — describe the TTFT + decode latency model.
                topologyIntraNode: z
                  .string()
                  .nullable()
                  .optional()
                  .describe("Raw characteristics.topology.intraNode value ('pcie', 'nvlink', 'nvlink-nvswitch', 'infiniband') or null when absent"),
                topologyInterNode: z
                  .string()
                  .nullable()
                  .optional()
                  .describe("Raw characteristics.topology.interNode value or null when absent"),
                topologyNodeCount: z
                  .number()
                  .optional()
                  .describe("Node count used when resolving topology latency factors (≥ 1)"),
                topologyTtftFactor: z
                  .number()
                  .optional()
                  .describe(
                    "TTFT latency scaling factor applied by the engine's GPU inference model (resolveTopologyLatencyFactors). " +
                    "Describes the TTFT+decode latency dimension — distinct from the throughput scaling factor."
                  ),
                topologyDecodeFactor: z
                  .number()
                  .optional()
                  .describe(
                    "Decode-rate latency scaling factor applied by the engine's GPU inference model (resolveTopologyLatencyFactors). " +
                    "Describes the TTFT+decode latency dimension — distinct from the throughput scaling factor."
                  ),
                topologyCalibrationStatus: z
                  .enum(["calibrated", "estimated", "not_applicable"])
                  .optional()
                  .describe(
                    "Calibration status of the TTFT+decode latency factors (resolveTopologyLatencyFactors). " +
                    "Entirely separate from topologyThroughputCalibrationStatus, which covers throughput scaling."
                  ),
                // Topology throughput fields (resolveTopologyScalingFactor) — describe the token capacity dimension.
                topologyThroughputFactor: z
                  .number()
                  .optional()
                  .describe(
                    "Throughput scaling coefficient applied by resolveTopologyScalingFactor to this cluster's token capacity " +
                    "(nodes × perNodeTokensPerSec × factor × gpuUtil/100). " +
                    "1.0 when topology.intraNode is absent or unrecognised (legacy baseline, topologyIsLegacyBaseline=true). " +
                    "Known fabric penalties: pcie≈0.70, nvlink≈0.85, nvlink-nvswitch≈0.92, infiniband≈1.0. " +
                    "Entirely separate from topologyTtftFactor/topologyDecodeFactor, which describe the TTFT+decode latency model."
                  ),
                topologyThroughputCalibrationStatus: z
                  .enum(["calibrated", "estimated", "not_applicable"])
                  .optional()
                  .describe(
                    "Calibration status of the throughput scaling factor (resolveTopologyScalingFactor). " +
                    "Distinct from topologyCalibrationStatus, which covers TTFT+decode latency factors. " +
                    "'estimated' for all current intraNode coefficients (engineering assumptions from bandwidth arithmetic). " +
                    "'not_applicable' on non-inferenceMode resources. " +
                    "Reserve 'calibrated' for when a directly measured per-request throughput ratio is added."
                  ),
                topologyIsLegacyBaseline: z
                  .boolean()
                  .optional()
                  .describe(
                    "true when topology.intraNode was absent or unrecognised, meaning topologyThroughputFactor=1.0 " +
                    "reflects the pre-topology legacy baseline (not a fabric-specific measurement). " +
                    "false when an explicit, recognised intraNode value was supplied and the throughput factor is topology-modelled."
                  ),
              })
              .passthrough()
              .optional()
              .describe(
                "Latency simulation model and GPU interconnect topology parameters for this resource. " +
                "latencyPath identifies which engine path runs at step time. " +
                "Two distinct model components: " +
                "(1) throughput scaling — topologyThroughputFactor (resolveTopologyScalingFactor) bounds effective token capacity; " +
                "topologyThroughputCalibrationStatus and topologyIsLegacyBaseline qualify that factor. " +
                "(2) latency shape — topologyTtftFactor + topologyDecodeFactor (resolveTopologyLatencyFactors) " +
                "scale TTFT and decode curves; topologyCalibrationStatus qualifies those factors. " +
                "Both components are present on inferenceMode Kubernetes clusters; latencyPath is present on all resource types."
              ),
          })
          .passthrough()
      )
      .optional()
      .describe("Per-resource billing parameters resolved by the engine at create time"),
  })
  .passthrough();

/**
 * Output schema shared by the authenticated and demo simulation.create tools.
 * Reflects the compact (default) shape; full mode passes the complete
 * simulation object through via .passthrough(), and every field is optional
 * so error / limit payloads also validate.
 */
const mcpScenarioAttributionSchema = z
  .object({
    id: z.string().describe("Live scenario catalog ID that supplied the simulation graph"),
    version: z.string().nullable().describe("Catalog version, when provided"),
    revision: z.string().nullable().describe("Catalog revision, when provided"),
    source: z.literal("scenario-catalog").describe("Trusted server-side attribution source"),
  })
  .strict();
const createOutputSchema = z
  .object({
    id: z.string().optional().describe("Unique simulation ID — use with simulation.step, simulation.metrics, etc."),
    name: z.string().optional().describe("Simulation name"),
    engineVersion: z.string().optional().describe("Simulation engine version used for this prediction."),
    predictionEffectiveConfigHash: z.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity."),
    calibrationEvidence: calibrationEvidenceOutputSchema.optional().describe("Owned-versus-modeled evidence and latency boundary."),
    predictionEvidence: storedPredictionEvidenceSchema.optional(),
    appWeight: z.enum(["lean", "typical", "heavy"]).optional(),
    appWeightDefaulted: z.boolean().optional(),
    status: z.string().optional().describe("Current simulation status"),
    traffic: z.number().optional().describe("Current traffic in RPS"),
    resilienceConfig: mcpResilienceConfigSchema.optional().describe(
      "Effective resilience model returned after create; per-edge retryPolicy values include defaults for omitted fields.",
    ),
    scenarioAttribution: mcpScenarioAttributionSchema.optional().describe(
      "Trusted server-side attribution copied from the live scenario catalog; absent for explicit resource-graph creates",
    ),
    scenarioHash: z.string().length(64).optional().describe("Canonical SHA-256 of the persisted scenario graph and attached traffic-pattern order"),
    effectiveConfigHash: z.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity; see replayIdentity.effectiveConfigHash for the original replay-only hash."),
    replayIdentity: replayIdentitySchema.optional(),
    resources: z
      .array(
        z
          .object({
            id: z.string().optional().describe("Resource ID"),
            name: z.string().optional().describe("Resource display name"),
            status: z.string().optional().describe("Health status (healthy/warning/critical/failed)"),
            cpuPercent: z.number().optional().describe("CPU utilization (%)"),
            routedRps: z.number().optional().describe("Requests per second routed to this resource (compute/kubernetes only)"),
            availabilityState: z
              .enum(["available", "degraded", "unavailable", "scaled_to_zero", "cold_start"])
              .optional()
              .describe("Availability derived from lifecycle and routed traffic; degraded can still serve, unavailable is failed/parked, scaled_to_zero and cold_start are Fargate no-task states"),
            isRoutable: z.boolean().optional().describe("Whether this compute/Kubernetes resource can receive traffic"),
            recoveryBlockedReason: z.string().optional().describe("Engine recovery guard currently blocking cooldown progress, when present"),
          })
          .passthrough()
      )
      .optional()
      .describe("Per-resource summary (compact mode) or full resource states (full mode)"),
    effectiveMaxInstances: z.number().optional().describe("The fleet-size ceiling the engine will enforce (autoscalingConfig.maxInstances, or the provider default when unset)"),
    effectiveMinInstances: z.number().optional().describe("The fleet-size floor the engine will enforce (autoscalingConfig.minInstances, or the provider default when unset)"),
    autoscalingConfig: z.object({}).passthrough().optional().describe("Effective simulation scaling config; full response also contains the ECS resource's linked CPU-only target-tracking policy."),
    normalizedConfig: normalizedConfigSchema.optional().describe(
      "Engine-resolved billing parameters for every resource: cost multipliers, hourly rates, autoscale thresholds (scaleOut/scaleIn CPU %), GPU SKU, per-node token throughput, billing floor, connection limits. " +
      "Use this immediately after create to verify the simulation was set up as intended — e.g. confirm which GPU SKU was resolved, the effective billing floor, or the autoscale CPU threshold that will drive scale-out."
    ),
    hpaAudit: z
      .object({
        targetSupplied: z.boolean(),
        suppliedField: z.string().nullable(),
        requestedTargetCpu: z.number().nullable(),
        effectiveScaleOutCpuPercent: z.number(),
        effectiveScaleInCpuPercent: z.number(),
        defaulted: z.boolean(),
        provider: z.string(),
        resourceCategory: z.string(),
        defaultExplanation: z.string().optional(),
        policyExplanation: z.string().optional(),
      })
      .optional()
      .describe("CPU HPA create-time audit: whether a target arrived, its accepted field, the persisted thresholds, and the provider-default explanation when omitted."),
  })
  .passthrough()
  .describe(
    "Compact created-simulation summary by default (id, name, status, traffic, per-resource summary, normalizedConfig). With responseMode 'full', the complete simulation object (all resource characteristics and connections) is returned instead."
  );

/**
 * Shared schema fragment for the normalizedConfig block returned by
/** Output schema for simulation.list — compact entries by default, full simulation objects in full mode. */
const listOutputSchema = z
  .object({
    simulations: z
      .array(
        z
          .object({
            id: z.string().optional().describe("Simulation ID"),
            name: z.string().optional().describe("Simulation name"),
            status: z.string().optional().describe("Current simulation status"),
            resourceCount: z.number().optional().describe("Number of resources in the simulation (compact mode)"),
          })
          .passthrough()
      )
      .optional()
      .describe("Simulations owned by this API key — compact entries (id, name, status, resourceCount) by default, complete simulation objects with responseMode 'full'"),
  })
  .passthrough();

const CREATE_RESPONSE_MODE_DESCRIBE =
  "Response detail level. 'compact' (default) returns id, name, status, traffic, and a per-resource summary (id, name, status, cpuPercent) — keeps the response small for agent loops. 'full' returns the complete simulation object including all resource characteristics and connections.";

const LIST_RESPONSE_MODE_DESCRIBE =
  "Response detail level. 'compact' (default) returns id, name, status, and resourceCount per simulation — keeps enumeration cheap for agent loops. 'full' returns the complete simulation objects including all resource characteristics and connections.";

const RESPONSE_MODE_DESCRIBE =
  "Response detail level. 'compact' (default) returns only principal metrics, errorBreakdown when available, per-resource status (id, name, status, cpuPercent, routedRps, availabilityState, isRoutable, recoveryBlockedReason, and failureLifecycle/routingState when provided), and this step's events — keeps observations small for agent loops. 'full' returns the complete backend step response including the entire simulation object with all resource characteristics and connections.";
