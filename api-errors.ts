/**
 * Only echo known, server-generated chaos delay validation text. Other REST
 * error bodies may contain request data, so never stringify them into MCP
 * responses.
 */
export function chaosDelayValidationMessage(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return;
  const body = data as Record<string, unknown>;
  if (body.error !== "Validation failed" || !Array.isArray(body.details)) return;

  const messages: string[] = [];
  for (const detail of body.details.slice(0, 32)) {
    if (typeof detail !== "object" || detail === null) continue;
    const { pointer, message } = detail as Record<string, unknown>;
    if (typeof pointer !== "string" || pointer.length > 160) continue;
    const match = pointer.match(/^(?:\/customInjections\/(0|[1-9]\d{0,5}))?\/(promotionDelaySeconds|restartDelaySeconds)$/);
    if (!match) continue;
    const field = match[2];
    const restriction = match[1] === undefined
      ? `${field} requires scenarioId database_crash without customInjections`
      : `${field} applies only to database_crash`;
    messages.push(`${pointer}: ${message === restriction ? restriction : `${field} must be an integer between 0 and 86400`}`);
    if (messages.length === 8) break;
  }
  return messages.length > 0 ? `Validation failed: ${messages.join("; ")}` : undefined;
}

// These are constraints, not response-message templates: no server-provided
// message, suggestion, received value, or arbitrary object key is interpolated.
const providers = "must be one of aws, gcp, azure, oci, digitalocean";
const injectionConstraints: Record<string, string> = {
  "": "must be an object describing a chaos injection",
  "/failureType": "must be one of region_outage, permanent_data_loss, database_crash, database_slowdown, database_overload, zone_outage, instance_failure, eks_spot_interruption, network_latency, network_partition, cascading_failure, cpu_stress",
  "/targetProvider": `${providers}; required for region or zone targeting of region_outage or permanent_data_loss`,
  "/targetRegion": "must be a string; region_outage requires a non-blank targetRegion",
  "/targetResourceId": "must be a string; permanent_data_loss requires an explicit resource, region, or zone target",
  "/targetResourceName": "must be a string",
  "/targetZone": "must be a string",
  "/duration": "must be a number",
  "/intensity": "must be a number between 0 and 100",
  "/startTime": "must be a number",
  "/affectedResources": "must be an array of strings",
  "/affectedResources/*": "must be a string",
};
const workloadConstraints: Record<string, string> = {
  "": "must be an object containing only documented workload fields",
  "/computeInstances": "must be a number at least 1",
  "/databaseInstances": "must be a number at least 1",
  "/storageGB": "must be a number at least 1",
  "/trafficRPS": "must be a number at least 1",
  "/latencyRequirementMs": "must be a number at least 1",
  "/targetTokensPerSec": "must be a number at least 1",
  "/primaryRegion": "must be a string",
  "/secondaryRegions": "must be an array of strings",
  "/secondaryRegions/*": "must be a string",
  "/dataResidencyRequirements": "must be an array of strings",
  "/dataResidencyRequirements/*": "must be a string",
  "/requiresMultiRegion": "must be a boolean",
  "/sourceProvider": providers,
  "/workloadType": "must be one of standard, inference",
};
const multiCloudConstraints: Record<string, string> = {
  "": "must be a multi-cloud exploration request object",
  "/optimizationWeights": "must be an object containing only cost, latency, and vendorLockIn",
  "/optimizationWeights/cost": "must be a number between 0 and 1",
  "/optimizationWeights/latency": "must be a number between 0 and 1",
  "/optimizationWeights/vendorLockIn": "must be a number between 0 and 1",
  "/maxCostPerHour": "must be a number greater than 0",
  "/errorBudgetPct": "must be a number between 0 and 100",
  "/modifiers": "must be an object",
  "/modifiers/awsCommitment": "must be one of on-demand, 1yr, 3yr",
  "/modifiers/azureHybridBenefit": "must be a boolean",
  "/modifiers/spotEligible": "must be a boolean",
  "/modifiers/oracleLicenseHolder": "must be a boolean",
};

function constraint(path: string, pointer: string, message: unknown): string | undefined {
  // Only bounded, canonical array indices can survive into displayed pointers.
  const normalized = pointer.replace(/\/(0|[1-9]\d{0,5})(?=\/|$)/g, "/*");
  if (path === "/api/multi-cloud/explore") {
    if (normalized === "/workloadProfile" || normalized.startsWith("/workloadProfile/")) {
      return Object.hasOwn(workloadConstraints, normalized.slice(16))
        ? workloadConstraints[normalized.slice(16)] : undefined;
    }
    return Object.hasOwn(multiCloudConstraints, normalized) ? multiCloudConstraints[normalized] : undefined;
  }
  const batch = path === "/api/chaos/batch";
  if (normalized === "") return "must be a chaos job request object";
  if (normalized === "/simulationId") return "must be a string identifying a simulation";
  if (batch && normalized === "/scenarios") return "must be an array containing 1 to 10 scenarios";
  if (batch && normalized === "/webhookUrl") return "must be a valid URL";
  if (batch && normalized === "/webhookSecret") return "must be a string";
  if (batch && !normalized.startsWith("/scenarios/*")) return;
  const scenario = batch ? normalized.slice("/scenarios/*".length) : normalized;
  if (scenario === "") return "must be a scenario object";
  if (scenario === "/scenarioId") return "must be a string identifying a chaos scenario";
  if (scenario === "/duration") return `must be a number between 10 and ${batch ? 300 : 1000}`;
  if (scenario === "/customInjections") return "must be an array of chaos injection objects";
  const isInjection = scenario.startsWith("/customInjections/*");
  const field = isInjection ? scenario.slice("/customInjections/*".length) : scenario;
  if (field === "/promotionDelaySeconds" || field === "/restartDelaySeconds") {
    const name = field.slice(1);
    const restriction = isInjection
      ? `${name} applies only to database_crash`
      : `${name} requires scenarioId database_crash without customInjections`;
    return message === restriction ? restriction : `${name} must be an integer between 0 and 86400`;
  }
  return isInjection && Object.hasOwn(injectionConstraints, field) ? injectionConstraints[field] : undefined;
}

/**
 * Route-scoped, fail-closed formatting for the three REST job-start endpoints.
 * Even malformed/unexpected 400 bodies stay generic rather than falling through
 * to transport-specific raw-body formatting. Other endpoints retain behavior.
 */
export function jobStartValidationMessage(path: string, data: unknown): string | undefined {
  if (!["/api/chaos/run", "/api/chaos/batch", "/api/multi-cloud/explore"].includes(path)) return;
  const generic = "Validation failed";
  if (typeof data !== "object" || data === null) return generic;
  const body = data as Record<string, unknown>;
  if (body.error !== generic || !Array.isArray(body.details)) return generic;
  const messages = new Set<string>();
  for (const detail of body.details.slice(0, 32)) {
    if (typeof detail !== "object" || detail === null) continue;
    const { pointer, message } = detail as Record<string, unknown>;
    if (typeof pointer !== "string" || pointer.length > 160 || pointer.includes("*")) continue;
    const help = constraint(path, pointer, message);
    if (help) messages.add(`${pointer || "/"}: ${help}`);
    if (messages.size === 8) break;
  }
  return messages.size ? `${generic}: ${Array.from(messages).join("; ")}` : generic;
}