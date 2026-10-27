import { NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateApiKey } from "@/lib/api/auth";
import { createMcpServer } from "@/lib/mcp/server";

export const maxDuration = 60;

/**
 * Remote MCP endpoint (Streamable HTTP, stateless). Authenticate with
 *   Authorization: Bearer rk_live_...
 * Each request gets its own server bound to the key's account.
 */
export async function POST(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;

  const server = createMcpServer(auth.supabase, auth.userId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // The response is fully built before cleanup (JSON mode), so closing is safe.
    server.close().catch(() => {});
  }
}

// Stateless server: no standalone SSE stream and no sessions to terminate.
const notAllowed = () => NextResponse.json({ error: "Use POST. This MCP server is stateless." }, { status: 405, headers: { Allow: "POST" } });
export const GET = notAllowed;
export const DELETE = notAllowed;
