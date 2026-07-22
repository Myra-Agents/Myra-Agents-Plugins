// MCP entrypoint — exposes the GitLab adapter's tools (gitlab_list_issues/
// gitlab_get_issue) to an agent over stdio. Wire it into an agent as an MCP
// server, e.g.:
//   { "command": "node", "args": ["<plugin>/mcp.mjs"],
//     "env": { "GITLAB_URL": "...", "GITLAB_TOKEN": "..." } }
import { runMcp } from "../_sdk/index.mjs";
import adapter from "./adapter.mjs";

runMcp(adapter);
