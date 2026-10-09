/**
 * Internal test harness only. The supported MCP product is the hosted
 * Streamable HTTP server; this file is excluded from the cwm-mcp package.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools";
import { jobStartValidationMessage } from "./api-errors";

const BASE_URL = process.env.CWM_BASE_URL;
if (!BASE_URL) {
  throw new Error("CWM_BASE_URL is required by the internal MCP test harness.");
}
const API_KEY = process.env.CWM_API_KEY ?? "";

async function apiCall(
  method: string,
  path: string,
  body?: unknown,
  requireAuth = false,
): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (requireAuth) {
    if (!API_KEY) {
      throw new Error("CWM_API_KEY is required by the internal MCP test harness.");
    }
    headers.Authorization = `Bearer ${API_KEY}`;
  } else if (API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const jobValidation = response.status === 400
      ? jobStartValidationMessage(path, data)
      : undefined;
    const errorMessage = jobValidation ?? (
      typeof data === "object" && data !== null && "error" in data
        ? (data as Record<string, unknown>).error
        : text
    );
    throw new Error(`API error ${response.status}: ${errorMessage}`);
  }

  return data;
}

const server = new McpServer({
  name: "cloud-world-model",
  version: "1.1.1",
});

registerTools(server, { apiCall, baseUrl: BASE_URL });

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Internal Cloud World Model MCP test harness running.");
