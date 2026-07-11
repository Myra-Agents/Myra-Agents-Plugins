// Desktop "installed app" OAuth2 with PKCE + loopback redirect. Zero deps.
// Generic over the service: the connector passes `auth = { scopes, authUri?,
// tokenUri?, injectedTokenEnv? }` (auth/token URIs default to Google). The
// refresh token is persisted in the OS keychain (macOS `security`) or a
// chmod-600 file, keyed per connector id — never in Myra settings.json. Access
// tokens are short-lived and kept in memory only.
import http from "node:http";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { platform } from "node:os";
import { writeFileSync, readFileSync, chmodSync } from "node:fs";
import { join } from "node:path";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const KEYCHAIN_ACCOUNT = "refresh_token";

const b64url = (buf) => buf.toString("base64url");
const service = (id) => `myra-connector-${id}`;
const tokenFile = () => join(process.cwd(), ".refresh_token"); // cwd = connector dir

// ---- refresh-token storage -------------------------------------------------

// Primary store = the Myra server's secret store, which is cross-platform via
// the `keyring` crate (macOS Keychain / Windows Credential Manager / Linux
// Secret Service). The connector never rolls its own per-OS keychain. Falls back
// to a local store only when no server is reachable (standalone dev).
export async function storeRefreshToken(id, token) {
  const rpcUrl = (process.env.RPC_URL || "http://127.0.0.1:4319").replace(/\/$/, "");
  try {
    const r = await fetch(`${rpcUrl}/rpc/set_plugin_secret`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.SERVER_TOKEN ? { authorization: `Bearer ${process.env.SERVER_TOKEN}` } : {}),
      },
      body: JSON.stringify({ plugin: id, key: "REFRESH_TOKEN", value: token }),
    });
    if (r.ok) return "server";
  } catch {
    /* no server reachable — fall back to local */
  }
  storeRefreshTokenLocal(id, token);
  return "local";
}

// Local fallback: OS keychain on macOS, a chmod-600 file elsewhere. Only used
// when the server is unreachable; the cross-platform path is the server store.
function storeRefreshTokenLocal(id, token) {
  if (platform() === "darwin") {
    try {
      execFileSync("security", ["add-generic-password", "-U", "-s", service(id), "-a", KEYCHAIN_ACCOUNT, "-w", token]);
      return;
    } catch { /* fall through to file */ }
  }
  const f = tokenFile();
  writeFileSync(f, token, { mode: 0o600 });
  chmodSync(f, 0o600);
}

export function loadRefreshToken(id) {
  if (platform() === "darwin") {
    try {
      return execFileSync("security", ["find-generic-password", "-s", service(id), "-a", KEYCHAIN_ACCOUNT, "-w"])
        .toString().trim();
    } catch { /* fall through */ }
  }
  try { return readFileSync(tokenFile(), "utf8").trim(); } catch { return null; }
}

// ---- one-time consent flow (run via the connector's connect.mjs) ------------

export async function runConsentFlow({ id, clientId, clientSecret, auth }) {
  const authUri = auth.authUri || GOOGLE_AUTH;
  const tokenUri = auth.tokenUri || GOOGLE_TOKEN;
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const stateTok = b64url(crypto.randomBytes(16));

  const { code, redirectUri } = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname !== "/") { res.writeHead(404).end(); return; }
      const err = url.searchParams.get("error");
      if (err) { res.end(`OAuth error: ${err}`); server.close(); return reject(new Error(err)); }
      if (url.searchParams.get("state") !== stateTok) {
        res.end("State mismatch"); server.close(); return reject(new Error("state mismatch"));
      }
      const port = server.address().port; // read before close(); address() is null after
      res.writeHead(200, { "content-type": "text/html" })
        .end(`<h2>${id} connected.</h2>You can close this tab and return to Myra.`);
      server.close();
      resolve({ code: url.searchParams.get("code"), redirectUri: `http://localhost:${port}/` });
    });
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const u = new URL(authUri);
      u.searchParams.set("client_id", clientId);
      u.searchParams.set("redirect_uri", `http://localhost:${port}/`);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("scope", (auth.scopes || []).join(" "));
      u.searchParams.set("access_type", "offline");
      u.searchParams.set("prompt", "consent");
      u.searchParams.set("code_challenge", challenge);
      u.searchParams.set("code_challenge_method", "S256");
      u.searchParams.set("state", stateTok);
      openBrowser(u.toString());
      console.error(`\nIf no browser opened, visit:\n${u.toString()}\n`);
    });
    setTimeout(() => { server.close(); reject(new Error("consent timed out")); }, 5 * 60_000);
  });

  const tok = await exchange(tokenUri, {
    clientId, clientSecret, redirectUri,
    body: { code, code_verifier: verifier, grant_type: "authorization_code" },
  });
  if (!tok.refresh_token) throw new Error("no refresh_token returned (revoke prior grant, retry)");
  const where = await storeRefreshToken(id, tok.refresh_token);
  console.error(`refresh token stored (${where === "server" ? "server secret store, cross-platform" : "local fallback"})`);
  return tok;
}

// ---- access-token minting (used by the runtime / mcp) ----------------------

const cache = new Map(); // id → { token, exp }

export async function accessToken({ id, clientId, clientSecret, auth }) {
  // Injected-token mode: when the app already brokers this service (e.g. a
  // Google connection with the right scopes), it hands us a fresh access token
  // via env and we skip our own OAuth. The app refreshes it (~1h TTL).
  const injected = auth?.injectedTokenEnv && process.env[auth.injectedTokenEnv];
  if (injected) return injected;

  const c = cache.get(id);
  if (c && Date.now() < c.exp - 60_000) return c.token;
  // Cross-platform path: the server injects the refresh token as env (from its
  // keyring secret store). Local keychain/file is only the standalone fallback.
  const refresh = process.env.REFRESH_TOKEN || loadRefreshToken(id);
  if (!refresh) throw new Error(`${id}: not connected — run the connector's connect step first`);
  const tok = await exchange(auth?.tokenUri || GOOGLE_TOKEN, {
    clientId, clientSecret,
    body: { refresh_token: refresh, grant_type: "refresh_token" },
  });
  cache.set(id, { token: tok.access_token, exp: Date.now() + tok.expires_in * 1000 });
  return tok.access_token;
}

async function exchange(tokenUri, { clientId, clientSecret, redirectUri, body }) {
  const form = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body });
  if (redirectUri) form.set("redirect_uri", redirectUri);
  const r = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!r.ok) throw new Error(`token endpoint ${r.status}: ${await r.text()}`);
  return r.json();
}

function openBrowser(url) {
  const cmd = platform() === "darwin" ? "open" : platform() === "win32" ? "cmd" : "xdg-open";
  const args = platform() === "win32" ? ["/c", "start", "", url] : [url];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).unref(); } catch { /* printed above */ }
}
