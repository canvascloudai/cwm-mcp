import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools";
import { jobStartValidationMessage } from "./api-errors";

// ─── stdio transport: authenticated-only — no demo mode ────────────────────
//
// DECISION: The stdio entry point intentionally registers only authenticated
// tools (registerTools). It does NOT call registerDemoTools and therefore
// carries no DemoHooks implementation.
//
// Rationale: stdio sessions are launched by local tooling / CI pipelines that
// already possess a CWM_API_KEY, so the anonymous demo path (rate-limited
// simulations, no API key) is unnecessary and would expose an unguarded
// public surface without a session-cookie ownership boundary.
//
// If a stdio/anonymous demo mode is added in the future, the implementor MUST
// satisfy the full DemoHooks contract from cwm-mcp/tools.ts with these
// lifecycle invariants — the same rules the Streamable HTTP transport follows:
//
//   • setCurrentSim(id)  — called ONLY on a successful create or successful
//                          explicit use of an owned simulation.
//   • forgetSim(id)      — called when the backend returns 404 (deleted /
//                          expired); clears the pointer if it matches id.
//   • getCurrentSim()    — never falls back to creation-time sort; returns
//                          undefined when no pointer is set.
//   • Mutations on FAILED or DENIED operations must NOT update the pointer.
//   • Reservation/commit/release (reserveSimSlot / commitSim / releaseSimSlot)
//     and step quota (reserveStep / refundStep) must be atomic pre-await so
//     concurrent tool calls cannot blow past caps.
//
// Violating any of these invariants will cause the two transports to drift in
// observable ways (stale pointer, double-count quota, silent ownership bypass).
// ────────────────────────────────────────────────────────────────────────────

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
    const jobValidation = res.status === 400
      ? jobStartValidationMessage(path, data)
      : undefined;
    const errMsg = jobValidation ?? (
      typeof data === "object" && data !== null && "error" in data
        ? (data as Record<string, unknown>).error
        : text
    );
    throw new Error(`API error ${res.status}: ${errMsg}`);
  }

  return data;
}

const server = new McpServer({
  name: "cloud-world-model",
  version: "1.1.0",
});

registerTools(server, { apiCall, baseUrl: BASE_URL });

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Cloud World Model MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
