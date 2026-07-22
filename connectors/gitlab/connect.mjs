// One-time: `node connect.mjs` — opens your GitLab instance's consent screen and
// stores the refresh token in your keychain (under `myra-connector-gitlab`).
// Only needed for the OAuth auth path — skip this entirely if you're using a
// Personal Access Token (set GITLAB_TOKEN in Settings → Plugins → gitlab, no
// connect step required at all).
//
// Reads GITLAB_URL / OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET from env (GITLAB_URL
// must already be exported before this runs — it's baked into adapter.auth's
// authorize/token URIs at import time), or pass --client-id / --client-secret.
import { runConsentFlow } from "../_sdk/oauth.mjs";
import adapter from "./adapter.mjs";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const clientId = arg("client-id") || process.env.OAUTH_CLIENT_ID;
// Public PKCE clients (gitlab.com Sign in via the shipped Myra app) have no
// secret; only self-hosted OAuth apps registered as confidential do.
const clientSecret = arg("client-secret") || process.env.OAUTH_CLIENT_SECRET || "";
if (!clientId) {
  console.error(
    "Need OAUTH_CLIENT_ID (env or --client-id) — register an Application on your GitLab " +
      "instance (User Settings → Applications; or Admin → Applications on self-hosted) with the \"api\" scope.",
  );
  process.exit(1);
}
try {
  await runConsentFlow({ id: adapter.id, clientId, clientSecret, auth: adapter.auth });
  console.error("Connected. Refresh token stored. The gitlab connector's actions can run now.");
  // Exit now — lingering AbortSignal.timeout timers in the token exchange /
  // storeRefreshToken keep the loop alive otherwise, delaying plugin-setup-done.
  process.exit(0);
} catch (e) {
  console.error("Failed:", e.message);
  process.exit(1);
}
