// One-time: `node connect.mjs` — opens the Google consent screen and stores the
// refresh token in your keychain (under `myra-connector-gmail`). Reads the
// shipped client from env, or pass --client-id / --client-secret to use your own.
import { runConsentFlow } from "../_sdk/oauth.mjs";
import adapter from "./adapter.mjs";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const clientId = arg("client-id") || process.env.OAUTH_CLIENT_ID;
const clientSecret = arg("client-secret") || process.env.OAUTH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Need OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET (env or --client-id/--client-secret).");
  process.exit(1);
}
try {
  await runConsentFlow({ id: adapter.id, clientId, clientSecret, auth: adapter.auth });
  console.error("Connected. Refresh token stored. You can start the connector now.");
} catch (e) {
  console.error("Failed:", e.message);
  process.exit(1);
}
