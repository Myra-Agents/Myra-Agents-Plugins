// Generic MCP server (stdio, JSON-RPC 2.0). Exposes the adapter's `tools` to an
// agent (Claude Code, opencode, …). Hand-rolled — MCP over stdio is just
// newline-framed JSON-RPC with initialize / tools/list / tools/call — so no
// @modelcontextprotocol/sdk dependency.
//
// Each adapter tool: { name, description, inputSchema, handler(args, ctx) }.
// `ctx.accessToken()` mints the connector's OAuth token when needed.
import readline from "node:readline";
import { accessToken } from "./oauth.mjs";

export function runMcp(adapter) {
  const authCfg = {
    id: adapter.id,
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    auth: adapter.auth,
  };
  const ctx = {
    accessToken: () => accessToken(authCfg),
    log: (...a) => console.error(`[${adapter.id}:mcp]`, ...a),
  };
  const tools = (adapter.tools || []).map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
  const byName = new Map((adapter.tools || []).map((t) => [t.name, t]));

  const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
  const ok = (id, result) => send({ jsonrpc: "2.0", id, result });
  const err = (id, message) => send({ jsonrpc: "2.0", id, error: { code: -32000, message } });

  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let req;
    try { req = JSON.parse(line); } catch { return; }
    const { id, method, params } = req;
    try {
      if (method === "initialize") {
        return ok(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: adapter.id, version: "0.1.0" },
        });
      }
      if (method === "notifications/initialized") return; // notification, no reply
      if (method === "tools/list") return ok(id, { tools });
      if (method === "tools/call") {
        const tool = byName.get(params.name);
        if (!tool) return err(id, `unknown tool ${params.name}`);
        const result = await tool.handler(params.arguments || {}, ctx);
        return ok(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      }
      if (id !== undefined) err(id, `unknown method ${method}`);
    } catch (e) {
      if (id !== undefined) err(id, e.message);
    }
  });
}
