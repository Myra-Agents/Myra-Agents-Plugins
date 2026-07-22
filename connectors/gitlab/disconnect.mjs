#!/usr/bin/env node
// Disconnect entrypoint (manifest `catalog.disconnect` — run via the server's
// run_plugin_setup rpc with action="disconnect"). Forgets the stored refresh
// token so the connection reverts to "not connected". No network to GitLab —
// GitLab has no token-revocation endpoint for public PKCE clients; we just drop
// our copy (the user can revoke the app on gitlab.com if they want).
import { clearRefreshToken } from "../_sdk/oauth.mjs";
import adapter from "./adapter.mjs";

await clearRefreshToken(adapter.id);
console.error(`[${adapter.id}] disconnected — refresh token cleared`);
// Exit now: a lingering AbortSignal.timeout timer inside clearRefreshToken would
// otherwise keep the process alive for seconds, delaying plugin-setup-done and
// the app's live update.
process.exit(0);
