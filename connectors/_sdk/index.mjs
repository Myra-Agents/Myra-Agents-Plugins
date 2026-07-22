// Connector runtime — the shared engine every integration runs on. A connector
// supplies a small adapter; this drives the whole lifecycle:
//
//   1. TRIGGER  — poll the service (adapter.poll), match RULES against the common
//      event shape, and create+launch an agent via the local Myra RPC
//      (add_card → launch_agent). Subscribing to `agent-result-changed` (in the
//      manifest) is what keeps Myra respawning the exec; the poll loop is ours.
//   2. SEND     — on `agent-result-changed`/done (piped to stdin as NDJSON), if
//      SEND_ON_DONE and the adapter has `send`, deliver the result back.
//
// Safety rails handled here for all connectors: DRY_RUN + REQUIRE_REVIEW default
// ON, per-hour trigger cap, event dedupe, body fenced as untrusted data.
//
// Offline test: set FAKE_EVENT (or FAKE_MESSAGE) to a JSON event and one trigger
// cycle runs against it (no network) then exits.
//
// Adapter contract:
//   {
//     id: string,                       // connector id (folder name)
//     auth?: { scopes, authUri?, tokenUri?, injectedTokenEnv? },  // OAuth (optional)
//     poll(ctx) -> event[],             // fetch new items, normalized-ish
//     isSelfSent?(event) -> boolean,    // skip our own outbound items
//     send?(ctx, { to, subject, text, event }) -> void,           // optional
//     cardTitle?(event, rule) -> string,// optional custom card title
//     tools?: [...]                     // MCP tools (used by runMcp, not here)
//   }
// ctx = { accessToken(): Promise<string>, log, config }.
import readline from "node:readline";

import { parseRules, matchRule, renderPrompt } from "./rules.mjs";
import { hasSeen, markSeen, allowTrigger } from "./state.mjs";
import { myraClient } from "./myra.mjs";
import { accessToken } from "./oauth.mjs";

export { runMcp } from "./mcp.mjs";

/**
 * Run one post-run action declared by the adapter (manifest `catalog.actions`).
 * Called by the server when a bound patrol/task finishes: it dispatches to
 * `adapter.actions[type]` with the action's config (templated against the
 * finished card) and the card itself. Thin + isolated — one action's failure is
 * the caller's to handle.
 */
export async function runAction(adapter, type, { config, card }) {
  const handler = adapter.actions?.[type];
  if (!handler) throw new Error(`${adapter.id}: no action "${type}"`);
  const ctx = {
    accessToken: () =>
      accessToken({
        id: adapter.id,
        clientId: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
        auth: adapter.auth,
      }),
    log: (...a) => console.error(`[${adapter.id}:action]`, ...a),
  };
  return handler(ctx, { config: renderConfig(config, card), card });
}

/**
 * Entrypoint for a connector's `run-action.mjs`: read `{ type, config, card }`
 * from stdin, run the action, print its JSON result on stdout, exit. Non-zero
 * exit + stderr on failure (the server logs it, other actions still run).
 */
export async function runActionFromStdin(adapter) {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch (e) {
    process.stderr.write(`bad action input: ${e.message}`);
    process.exit(1);
  }
  try {
    const result = await runAction(adapter, payload.type, { config: payload.config, card: payload.card });
    process.stdout.write(JSON.stringify(result ?? { ok: true }));
    process.exit(0);
  } catch (e) {
    process.stderr.write(String(e?.message || e));
    process.exit(1);
  }
}

/**
 * Entrypoint for a connector's `options.mjs`: read `{ field, search?, page?,
 * context? }` from stdin, call the adapter's `options[field]` handler, print
 * `{ options: [{value,label}], hasMore }` on stdout, exit. Powers dynamic
 * config-field dropdowns (e.g. GitLab's project / author pickers) with
 * lazy-loading — the server proxies a `connector_options` rpc here. `context`
 * carries sibling field values a handler may depend on (e.g. author needs the
 * selected project). Read-only; same access-token wiring as actions.
 *
 * A handler may return a bare `[{value,label}]` array (treated as a single page,
 * `hasMore: false`) or `{ options, hasMore }` for pagination.
 */
export async function runOptionsFromStdin(adapter) {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch (e) {
    process.stderr.write(`bad options input: ${e.message}`);
    process.exit(1);
  }
  const handler = adapter.options?.[payload.field];
  if (!handler) {
    process.stderr.write(`${adapter.id}: no options for field "${payload.field}"`);
    process.exit(1);
  }
  const ctx = {
    accessToken: () =>
      accessToken({
        id: adapter.id,
        clientId: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
        auth: adapter.auth,
      }),
    log: (...a) => console.error(`[${adapter.id}:options]`, ...a),
  };
  try {
    const raw = await handler(ctx, {
      search: payload.search,
      page: payload.page || 1,
      context: payload.context || {},
    });
    const result = Array.isArray(raw) ? { options: raw, hasMore: false } : { options: raw?.options ?? [], hasMore: !!raw?.hasMore };
    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  } catch (e) {
    process.stderr.write(String(e?.message || e));
    process.exit(1);
  }
}

/** Resolve {{result}} {{title}} {{status}} {{card.<field>}} in an action config. */
export function renderConfig(config, card) {
  const base = { result: card?.agentResult ?? "", title: card?.title ?? "", status: card?.status ?? "" };
  const tmpl = (v) =>
    typeof v === "string"
      ? v.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (_, k) =>
          k.startsWith("card.") ? String(card?.[k.slice(5)] ?? "") : String(base[k] ?? ""),
        )
      : v;
  const out = {};
  for (const [k, v] of Object.entries(config || {})) out[k] = tmpl(v);
  return out;
}

/**
 * Poll-and-report runtime — the outbound alternative to inbound webhooks. No
 * public URL needed: the connector polls the service (adapter.pollProject) for
 * the targets the server says to watch (myra.watch), dedupes, and reports each
 * new event to the server's `connector_event` rpc, which matches it against
 * every enabled patrol's eventTrigger rules and launches the bound one. The
 * connector stays a thin event source; the patrol store owns the routing.
 *
 * Kept alive by the manifest's `subscribes` (the server runs the exec
 * long-lived); this loop ignores stdin. Offline test: FAKE_EVENT reports one
 * event and exits.
 */
export async function runReporter(adapter) {
  const cfg = {
    clientId: env("OAUTH_CLIENT_ID", ""),
    clientSecret: env("OAUTH_CLIENT_SECRET", ""),
    rpcUrl: env("RPC_URL", "http://127.0.0.1:4319"),
    token: env("SERVER_TOKEN", ""),
    pollSeconds: num("POLL_SECONDS", 60),
    dryRun: bool("DRY_RUN", false),
  };
  const myra = myraClient({ rpcUrl: cfg.rpcUrl, token: cfg.token });
  const log = (...a) => console.error(`[${adapter.id}]`, ...a);
  const ctx = {
    accessToken: () =>
      accessToken({ id: adapter.id, clientId: cfg.clientId, clientSecret: cfg.clientSecret, auth: adapter.auth }),
    log,
    config: process.env,
  };

  const fake = process.env.FAKE_EVENT;
  if (fake) {
    const event = { connector: adapter.id, ...normalizeEvent(JSON.parse(fake)) };
    log(`FAKE — report → connector_event id=${event.id}`);
    if (!cfg.dryRun) log(`launched: ${JSON.stringify(await myra.connectorEvent(event))}`);
    else log("DRY — not reported");
    process.exit(0);
  }

  if (!(await myra.ping().catch(() => false))) log(`warning: Myra server not reachable at ${cfg.rpcUrl}`);
  log(`reporter started — polling every ${cfg.pollSeconds}s`);
  poll();

  async function poll() {
    try {
      const watch =
        (await myra.watch(adapter.id).catch((e) => {
          log("watch error:", e.message);
          return {};
        })) || {};
      const targets = watch.projects || [];
      for (const target of targets) {
        const events = (await adapter.pollProject(ctx, target)) || [];
        for (const raw of events) {
          const event = { connector: adapter.id, ...normalizeEvent(raw) };
          // Dedupe per target so the same event id under two projects both fire.
          const key = `${target.project ?? ""}:${event.id}`;
          if (hasSeen(key)) continue;
          markSeen(key);
          if (adapter.isSelfSent?.(event)) continue;
          if (cfg.dryRun) {
            log(`DRY event ${key}`);
            continue;
          }
          try {
            await myra.connectorEvent(event);
            log(`reported ${event.type || "event"} ${key}`);
          } catch (e) {
            log("report error:", e.message);
          }
        }
      }
    } catch (e) {
      log("poll error:", e.message);
    } finally {
      setTimeout(poll, cfg.pollSeconds * 1000);
    }
  }
}

export async function runConnector(adapter) {
  const cfg = {
    clientId: env("OAUTH_CLIENT_ID", ""),
    clientSecret: env("OAUTH_CLIENT_SECRET", ""),
    rpcUrl: env("RPC_URL", "http://127.0.0.1:4319"),
    token: env("SERVER_TOKEN", ""),
    agentPresetId: env("AGENT_PRESET_ID", ""),
    workingDir: env("WORKING_DIR", ""),
    pollSeconds: num("POLL_SECONDS", 60),
    rules: parseRules(env("RULES", "[]")),
    requireReview: bool("REQUIRE_REVIEW", true),
    maxPerHour: num("MAX_TRIGGERS_PER_HOUR", 20),
    sendOnDone: bool("SEND_ON_DONE", false),
    sendTo: env("SEND_TO", ""),
    dryRun: bool("DRY_RUN", true),
  };
  const myra = myraClient({ rpcUrl: cfg.rpcUrl, token: cfg.token });
  const log = (...a) => console.error(`[${adapter.id}]`, ...a);
  const ctx = {
    accessToken: () =>
      accessToken({ id: adapter.id, clientId: cfg.clientId, clientSecret: cfg.clientSecret, auth: adapter.auth }),
    log,
    config: process.env,
  };
  const origin = new Map(); // cardId → originating event (for threaded replies)

  if (cfg.dryRun) log("DRY_RUN on — matches logged, nothing created / sent.");
  if (!cfg.rules.length) log("warning: RULES is empty — nothing will trigger.");

  async function trigger(rule, event) {
    if (!allowTrigger(cfg.maxPerHour)) { log(`rate cap hit — dropping "${event.subject}"`); return; }
    const review = rule.requireReview ?? cfg.requireReview;
    const prompt = renderPrompt(rule.prompt, event);
    if (cfg.dryRun) { log(`DRY match rule="${rule.name}" subject="${event.subject}" review=${review}`); return; }

    const title = (
      adapter.cardTitle ? adapter.cardTitle(event, rule) : `${rule.name || adapter.id}: ${event.subject || "(no subject)"}`
    ).slice(0, 120);
    const card = await myra.addCard({
      title,
      description: `From: ${event.from}\nId: ${event.id}`,
      agentPrompt: prompt,
      agentPresetId: rule.agentId || cfg.agentPresetId || undefined,
      status: "todo",
      tags: [adapter.id, rule.name || "rule"],
      workingDir: cfg.workingDir || undefined,
    });
    origin.set(card.id, event);
    if (review) { log(`card ${card.id} created (held for review) rule="${rule.name}"`); return; }
    const res = await myra.launchAgent(card.id, cfg.workingDir || undefined);
    log(`card ${card.id} launched rule="${rule.name}" → ${JSON.stringify(res)}`);
  }

  // 2. send: react to finished cards on stdin
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let frame;
    try { frame = JSON.parse(line); } catch { return; }
    if (frame.event !== "agent-result-changed") return;
    const card = frame.payload?.card;
    if (!card || card.status !== "done" || !cfg.sendOnDone || typeof adapter.send !== "function") return;
    const event = origin.get(card.id);
    const to = cfg.sendTo || event?.from;
    if (!to) { log("card done but no SEND_TO and no known origin — skipping send"); return; }
    const subject = event ? `Re: ${event.subject}` : `Myra: ${card.title || ""}`;
    const text = `${card.agentResult || "(no result)"}\n\n— Myra Agents`;
    if (cfg.dryRun) { log(`DRY send → ${to} subject="${subject}"`); return; }
    try { await adapter.send(ctx, { to, subject, text, event }); log(`sent result → ${to}`); }
    catch (e) { log("send error:", e.message); }
  });

  // start
  if (!(await myra.ping().catch(() => false))) log(`warning: Myra server not reachable at ${cfg.rpcUrl}`);

  const fake = process.env.FAKE_EVENT || process.env.FAKE_MESSAGE;
  if (fake) {
    const event = normalizeEvent(JSON.parse(fake));
    log(`FAKE mode — from="${event.from}" subject="${event.subject}"`);
    const rule = matchRule(cfg.rules, event);
    if (!rule) { log("no rule matched the fake event"); process.exit(2); }
    log(`matched rule="${rule.name}"`);
    await trigger(rule, event);
    log("fake cycle done");
    process.exit(0);
  }

  log(`started — polling every ${cfg.pollSeconds}s, ${cfg.rules.length} rule(s)`);
  poll();

  async function poll() {
    try {
      const events = (await adapter.poll(ctx)) || [];
      for (const raw of events) {
        const event = normalizeEvent(raw);
        if (hasSeen(event.id)) continue;
        markSeen(event.id);
        if (adapter.isSelfSent?.(event)) continue;
        const rule = matchRule(cfg.rules, event);
        if (rule) await trigger(rule, event);
      }
    } catch (e) {
      log("poll error:", e.message);
    } finally {
      setTimeout(poll, cfg.pollSeconds * 1000);
    }
  }
}

// Ensure the canonical fields exist while preserving adapter-specific extras
// (threadId, messageIdHeader, raw, …) via the spread.
function normalizeEvent(e) {
  return {
    ...e,
    id: String(e.id ?? e.messageId ?? ""),
    from: e.from ?? "",
    to: e.to ?? "",
    subject: e.subject ?? "",
    body: e.body ?? "",
    snippet: e.snippet ?? "",
    thread: e.thread ?? e.threadId ?? "",
  };
}

const env = (k, d) => { const v = process.env[k]; return v === undefined || v === "" ? d : v; };
const num = (k, d) => { const v = process.env[k]; return v ? Number(v) : d; };
const bool = (k, d) => { const v = process.env[k]; return v === undefined ? d : v === "true" || v === "1"; };
