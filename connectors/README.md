# Connectors

A **connector** is an event-reaction plugin that turns "something happened in an
external service" into a running agent — and, optionally, sends the result back
and exposes the service as MCP tools. Gmail, Slack, Notion, Stripe, GitHub-poll…
all follow the same shape.

Every connector runs on the **shared SDK** in [`_sdk/`](./_sdk). You write a small
**adapter**; the SDK does the rest: poll loop, rule matching, card
creation + agent launch, send-on-done, dedupe, rate limiting, the untrusted-input
fence, the MCP host, and OAuth.

```
connectors/
  _sdk/            ← shared runtime (no manifest → not a plugin, just a library)
    index.mjs      runConnector(adapter) · runMcp(adapter)
    rules.mjs      filter matching + prompt templating + untrusted-input fence
    state.mjs      dedupe + per-hour rate cap (state in the connector's own dir)
    myra.mjs       local /rpc client (add_card → launch_agent)
    oauth.mjs      desktop OAuth2 (PKCE + loopback), keyed per connector
    mcp.mjs        generic MCP stdio host
  gmail/           ← a connector = a thin adapter (the reference implementation)
    adapter.mjs    poll / isSelfSent / send / tools   ← the only service-specific code
    gmail.mjs      the service's REST client
    reactor.mjs    `runConnector(adapter)`  (manifest exec)
    mcp.mjs        `runMcp(adapter)`
    connect.mjs    one-time OAuth consent
    manifest.json  config + `subscribes: ["agent-result-changed"]`
```

## Deployment: how `../_sdk` resolves

Installed, connectors go flat under `~/.myra-agents/plugins/` — e.g.
`plugins/gmail/` next to `plugins/_sdk/`. The relative import `../_sdk` therefore
resolves the same **in the repo** (`connectors/gmail` → `connectors/_sdk`) and
**installed** (`plugins/gmail` → `plugins/_sdk`). `_sdk` has no `manifest.json`,
so the server's plugin scan skips it — it's present as a library, invisible as a
plugin. A connector install must also ensure `_sdk` is present (handled by the
catalog installer).

## The adapter contract

```js
export default {
  id: "slack",                                   // connector id = folder name
  auth: { scopes: [...], injectedTokenEnv: "..." }, // optional (OAuth2)

  async poll(ctx) { /* → event[] */ },           // fetch new items (TRIGGER side)
  isSelfSent(event) { /* → boolean */ },         // optional: skip our own output
  async send(ctx, { to, subject, text, event }) {}, // optional: built-in send-on-done
  cardTitle(event, rule) { /* → string */ },     // optional: custom card title
  tools: [ { name, description, inputSchema, handler(args, ctx) } ], // optional MCP

  // ACTION side — post-run actions, dispatched by runAction(adapter, type, …).
  // Declared for the UI in the manifest's `catalog.actions` (label + config form).
  actions: {
    async send(ctx, { config, card }) { /* config already templated */ },
    async draft(ctx, { config, card }) {},
  },
};
```

A connector is a **trigger** (it has `poll`), an **action provider** (it has
`actions` + declares `catalog.actions`), or both. The picker detects each by the
`catalog.verbs` (`"trigger"` vs `"action"`/`"notify"`). Action `config` values may
template the run result: `{{result}}`, `{{title}}`, `{{status}}`, `{{card.*}}`.

- **Event shape** (what `poll` returns, and what RULES match against):
  `{ id, from, subject, body, snippet?, thread?, ...serviceExtras }`. Normalize
  your service's items to this; keep any extra fields for `send`.
- **`ctx`** = `{ accessToken(): Promise<string>, log, config }`.
- **Rules** (`from` / `subjectContains` / `bodyContains` / `regex`) then work
  identically across every connector.

## Config every connector inherits (no code)

Injected as env by the host, read by the SDK — the adapter never touches them:
`RPC_URL`, `SERVER_TOKEN`, `AGENT_PRESET_ID`, `WORKING_DIR`, `RULES`,
`REQUIRE_REVIEW`, `MAX_TRIGGERS_PER_HOUR`, `SEND_ON_DONE`, `SEND_TO`, `DRY_RUN`,
`OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`. Add only your service's own keys
(e.g. `GMAIL_QUERY`, `SLACK_TOKEN`).

## Three connector shapes

Not every connector needs a poll loop:

| Shape | Trigger | Actions | Example |
|---|---|---|---|
| **Poll connector** | `runConnector(adapter)` long-lived, `adapter.poll()` on a timer | `adapter.actions` via `run-action.mjs` | `gmail` — no per-project webhook for "new mail" |
| **Manifest-only webhook** | core-handled inbound webhook, `verify`+`map` (no exec at all) | none | `integrations/github` — one event shape, no action side |
| **Webhook trigger + exec actions** | core-handled inbound webhook, `exec` transform (multiple event shapes on one URL) | `adapter.actions` via `run-action.mjs` | `gitlab` — push/MR/issue on one URL, discriminated by a header |

A connector with a real per-project/per-item webhook and no reason to poll skips
`exec`/`subscribes`/`reactor.mjs` entirely — see `gitlab/manifest.json` (no
top-level `exec`, only `webhooks` + `runAction`). The trigger side then routes
through the core's `connector_event` rpc (server-side, matches every enabled
patrol's `eventTrigger` rules) instead of this SDK's own `RULES`/poll loop —
see `connector-trigger-binding.md`'s "v2" binding and `PROTOCOL.md`'s "Role 4 —
Patrol actions". `runAction` (any shape) is still request/response via
`run-action.mjs` / `runActionFromStdin(adapter)`, unchanged.

## Write a new connector

1. `connectors/<id>/adapter.mjs` — implement `poll` (+ `send`/`tools` if useful).
2. `connectors/<id>/reactor.mjs` — `import { runConnector } from "../_sdk/index.mjs"; import a from "./adapter.mjs"; runConnector(a);`
3. `connectors/<id>/mcp.mjs` (if it has tools) — `runMcp(a)`.
4. `connectors/<id>/manifest.json` — `exec: node`, `args: ["reactor.mjs"]`,
   `subscribes: ["agent-result-changed"]`, plus your service's config keys.
5. Test offline: `FAKE_EVENT='{"from":"…","subject":"…","body":"…"}' RULES='[…]'
   DRY_RUN=false AGENT_PRESET_ID=echo node reactor.mjs` (needs a running server).

That's it — ~40–80 lines for a whole integration.

## Test the runtime without a service

`FAKE_EVENT` (or `FAKE_MESSAGE`) injects one event and runs a single trigger
cycle, no network — proving mail/event → card → agent through the SDK.
