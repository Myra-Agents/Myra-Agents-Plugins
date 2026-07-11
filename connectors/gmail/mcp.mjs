// MCP entrypoint — exposes the Gmail adapter's tools (gmail_search/get/send) to
// an agent over stdio. Wire it into an agent as an MCP server, e.g.:
//   { "command": "node", "args": ["<plugin>/mcp.mjs"],
//     "env": { "OAUTH_CLIENT_ID": "...", "OAUTH_CLIENT_SECRET": "..." } }
import { runMcp } from "../_sdk/index.mjs";
import adapter from "./adapter.mjs";

runMcp(adapter);
