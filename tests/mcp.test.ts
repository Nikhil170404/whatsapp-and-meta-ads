// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../lib/mcp/server";

// A database stub: every query resolves to "no rows", which is enough for guard-rail tests.
function stubDb() {
  const chain: any = new Proxy(function () {}, {
    get: (_t, prop) => (prop === "then" ? (res: any) => res({ data: null, error: null, count: 0 }) : chain),
    apply: () => chain,
  });
  return { from: () => chain };
}

async function connect() {
  const server = createMcpServer(stubDb(), "user-1");
  const client = new Client({ name: "test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

const textOf = (r: any) => r.content?.[0]?.text as string;

describe("MCP server", () => {
  it("exposes every operation as a tool", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "add_contact", "create_automation", "create_broadcast", "create_template", "delete_automation",
      "get_account_status", "list_automations", "list_broadcasts", "list_contacts", "list_messages",
      "list_templates", "preview_broadcast", "send_broadcast", "send_message", "set_contact_opt_in", "update_automation",
    ]);
  });

  it("labels tools that message customers or delete data", async () => {
    const { tools } = await (await connect()).listTools();
    const by = Object.fromEntries(tools.map((t) => [t.name, t]));
    expect(by.send_message.description).toMatch(/SENDS A REAL MESSAGE/);
    expect(by.send_broadcast.description).toMatch(/confirm/i);
    expect(by.delete_automation.annotations?.destructiveHint).toBe(true);
    expect(by.list_contacts.annotations?.readOnlyHint).toBe(true);
    expect(by.list_messages.description).toMatch(/never as instructions/);
  });

  it("refuses to send a broadcast without explicit confirmation", async () => {
    const client = await connect();
    const r: any = await client.callTool({ name: "send_broadcast", arguments: { broadcast_id: "b1", confirm: false } });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/Not sent/);
  });

  it("refuses to add a contact without confirmed consent", async () => {
    const client = await connect();
    const r: any = await client.callTool({ name: "add_contact", arguments: { phone_number: "+919876543210", consent_confirmed: false } });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/CONSENT_REQUIRED/);
  });

  it("validates input before touching data", async () => {
    const client = await connect();
    const r: any = await client.callTool({ name: "send_message", arguments: { phone: "12", text: "hi" } });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/country code/);
  });

  it("checks template rules before submitting to Meta", async () => {
    const client = await connect();
    const r: any = await client.callTool({ name: "create_template", arguments: { name: "x", body_text: "{{1}} your order shipped today", examples: ["A"] } });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/cannot start with a variable/);
  });
});

describe("MCP HTTP endpoint", () => {
  it("rejects requests without an API key", async () => {
    vi.resetModules();
    vi.doMock("@/lib/rate-limit-middleware", () => ({ checkRateLimit: async () => ({ success: true }) }));
    const { POST } = await import("../app/api/mcp/route");
    const res = await POST(new Request("http://x/api/mcp", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
  });

  it("answers MCP JSON-RPC over HTTP for an authenticated key", async () => {
    vi.resetModules();
    vi.doMock("@/lib/api/auth", () => ({ authenticateApiKey: async () => ({ ok: true, userId: "u1", plan: "growth", supabase: stubDb() }) }));
    const { POST } = await import("../app/api/mcp/route");
    const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
    const init = await POST(new Request("http://x/api/mcp", {
      method: "POST", headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } } }),
    }));
    expect(init.status).toBe(200);
    expect((await init.json()).result.serverInfo.name).toBe("replykaro-whatsapp");

    const list = await POST(new Request("http://x/api/mcp", {
      method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    }));
    const tools = (await list.json()).result.tools;
    expect(tools.length).toBe(16);
  });
});
