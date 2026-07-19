# Myra Agents — Plugin Protocol

Myra Agents' core server (`myra-server`) is a closed binary, but it loads
**open-source plugins** at runtime. This document is the entire contract: a
plugin is a directory with a `manifest.json` and (optionally) an executable. No
core API, no recompile, no SDK lock-in — any language works.

## Where plugins live

```
~/.myra-agents/plugins/<name>/
  manifest.json        # required
  <your executable>    # optional, for the event-reaction role
```

(`~/.myra-agents-demo/plugins/…` when the app runs in demo mode.) The server
scans this directory once at startup. Restart to pick up changes.

## Manifest

```json
{
  "name": "slack-notify",
  "version": "0.1.0",
  "exec": "./slack-notify",
  "args": [],
  "subscribes": ["agent-result-changed"],
  "providesAgents": [
    {
      "id": "echo",
      "name": "Echo Agent",
      "binary": "./echo-agent",
      "argsTemplate": "{prompt}"
    }
  ]
}
```

| Field            | Type       | Notes |
|------------------|------------|-------|
| `name`           | string     | **required**, unique. |
| `version`        | string     | semver, informational. |
| `exec`           | string     | executable for the event-reaction role. Relative paths (`./x`) resolve against the plugin dir; bare names (`node`, `python`) resolve on `PATH`. Omit for agent-only plugins. |
| `args`           | string[]   | extra argv passed to `exec`. |
| `subscribes`     | string[]   | bus events to forward to `exec`'s stdin. `["*"]` = all. Empty/absent = no event role. |
| `providesAgents` | AgentPreset[] | agent presets this plugin contributes. |

`AgentPreset`: `{ id, name, binary, argsTemplate, workingDir? }`. `argsTemplate`
**must** contain `{prompt}`. `binary` is path-resolved like `exec` (so a plugin
can ship its own agent executable). See `schema/manifest.schema.json`.

A plugin may fill **either or both** roles.

## Role 1 — Agent provider

`providesAgents` presets become resolvable agents, surfaced in the desktop agent
picker after the user's own presets. When a card runs such an agent, the core
spawns `binary` with `argsTemplate` (the literal `{prompt}` replaced by the
card's prompt) — exactly like a user-defined preset. No live IPC; the manifest is
the whole contract. See `agents/echo-agent/`.

## Role 2 — Event reaction

If `subscribes` is non-empty, the core runs `exec` **long-lived** and writes one
JSON object per line (NDJSON) to its **stdin** for every matching bus frame:

```
{"event":"agent-result-changed","payload":{ "card": { … } }}
{"event":"agent-log-appended","payload":{ "cardId":"…","runId":"…","line":"…" }}
{"event":"schedules-updated","payload":{ … }}
```

- Delivery is **fire-and-forget, one-way** — the core does not read your stdout
  for protocol; your stdout/stderr is captured and reprinted as `[plugin:<name>]`.
- Match by the top-level `event` string (or subscribe `"*"`).
- **`agent-log-appended` is high-volume** (one frame per agent output line) — only
  subscribe to it if you mean to.
- If your process exits, the core respawns it with jittered backoff (0.5s → 10s).
  A fresh process gets a fresh subscription — no replay of frames buffered while
  it was down.

See `notifications/slack-notify/`.

## Config — user-supplied settings

A plugin declares the settings it needs under `config`; the app renders them as a
form in **Settings → Plugins** and the user fills them in. Each field:

```json
{ "key": "WEBHOOK_URL", "label": "Slack webhook URL", "type": "secret", "required": true }
```

| Field | Notes |
|-------|-------|
| `key` | `^[A-Z][A-Z0-9_]*$`. Referenced by `webhooks` (`urlFrom`/`secretFrom`) and injected as an **env var** of the same name into any `exec`. |
| `type` | `string` · `secret` · `boolean` · `number` · `select` · `multiselect`. |
| `options` | choices for `select`/`multiselect`. |
| `required`, `default`, `description`, `placeholder` | form hints. |

**`secret`-typed values live in the OS keychain** — never written to
`settings.json`, never logged. Non-secret values persist in `settings.json` under
`pluginConfig.<plugin>`.

## Role 3 — Webhooks (handled by the core)

A plugin can declare **webhooks** the server core runs on its behalf — no
executable needed. This is how `integrations/slack`, `discord`, `github` work:
manifest-only.

### Outbound — POST on bus events

```json
{ "id": "notify", "direction": "out",
  "urlFrom": "WEBHOOK_URL",
  "events": ["awaiting_review", "waiting_feedback", "done"],
  "template": "{\"text\":\"{{card.title}} → {{card.status}}\"}" }
```

When a bus event matches `events`, the core renders `template` (mustache-lite:
`{{card.title}}`, `{{card.status}}`, `{{card.agentResult}}`), resolves `urlFrom`
from config, and POSTs (with retry). No subprocess.

### Inbound — a signed HTTP route

```json
{ "id": "intake", "direction": "in", "route": "github",
  "verify": { "scheme": "hmac-sha256", "header": "X-Hub-Signature-256", "secretFrom": "GH_SECRET" },
  "action": "create_card",
  "map": { "title": "$.pull_request.title", "body": "$.pull_request.body" } }
```

The core exposes `POST /hooks/<plugin>/<route>`, **verifies the signature** with
the named scheme + the resolved secret (401 on mismatch), **maps** the JSON body
via `map` (JSONPath), and dispatches `action` (e.g. `create_card`). Webhook routes
authenticate by signature, not the bearer token.

- Named `verify.scheme` values: `hmac-sha256`, `slack`, `stripe`, `gitlab` (plain
  constant-time compare against `X-Gitlab-Token` — GitLab has no HMAC signature).
- Inbound senders can't reach `127.0.0.1`: use a publicly reachable instance, a
  port-forward/tunnel, or (enrolled) the hub's public webhook URL.
- `action` can be a built-in rpc (`create_card`/`add_card`) or `"connector_event"` —
  routes the mapped payload to every enabled patrol whose `eventTrigger.connector`
  matches `payload.connector` and whose rules match (see "Role 4 — Patrol actions"
  below for the payload shape a connector should map/normalize to).

### Escape hatch — `exec`

When a named scheme or `map` can't express a service, add `"exec": "./transform"`.
The core invokes it **request/response** (not long-lived): the raw request
(`{ "headers": {…}, "body": "…" }`) on **stdin**; the plugin replies on **stdout**
with `{ "verified": true, "payload": {…} }` (inbound) or the body to POST
(outbound). Non-zero exit / bad output ⇒ rejected + logged. Config is injected as
env, same as agent binaries.

## Role 4 — Patrol actions

A plugin declares what it can do **after a patrol's card finishes** under
`catalog.actions` (see `schema/manifest.schema.json`'s `$defs.catalog.actions`) —
surfaced in the app's patrol editor as an Actions picker, each action's `config`
rendered as a form. To actually run one, the manifest also needs:

```json
{ "runAction": "./run-action.mjs" }
```

When a patrol's card reaches `done`, the core walks its configured `actions`,
templates each one's `config` (`{{result}}`, `{{title}}`, `{{status}}`, `{{card.*}}`
against the finished card), and invokes `runAction` **request/response** (not
long-lived, same resolution + timeout as the webhook `exec` escape hatch):
`{ "type": "<action id>", "config": {…templated}, "card": {…} }` on **stdin**, a
JSON result on **stdout**. One action failing is logged and does not block the
others or fail the run. See `connectors/gmail/run-action.mjs` for the reference
shape (`runActionFromStdin(adapter)` from the connector SDK).

This is the symmetric counterpart to Role 3's inbound webhooks: webhooks bring an
external event **in** to trigger a patrol; `runAction` sends a patrol's result
**out** once it's done.

## Role 5 — In-app setup (Connect)

A plugin that needs a one-time interactive step before it works (OAuth consent,
mainly) declares it under `catalog.setup`:

```json
{ "catalog": { "setup": { "type": "oauth", "command": "node connect.mjs", "label": "Connect GitLab" } } }
```

The app renders a **Connect** button (`setup.label`) that calls the
`run_plugin_setup { instanceId }` rpc. Unlike `runAction`/webhook `exec`
(request/response, bounded by a timeout), this spawns `setup.command`
**long-lived enough to complete the flow** — an OAuth consent command opens a
browser and waits on a loopback redirect (see
`connectors/_sdk/oauth.mjs::runConsentFlow`, up to 5 minutes). The rpc itself
returns immediately (`{ "started": true }`); progress streams on the bus as
`plugin-setup-log { id, line }` per output line, finishing with
`plugin-setup-done { id, ok }`. Refuses a second concurrent setup for the same
instance. `cwd` = the plugin dir, `env` = the instance's resolved config (same
resolution as `exec`/`runAction`).

## Events reference

| Event                  | Payload shape (abridged) |
|------------------------|--------------------------|
| `agent-result-changed` | `{ "card": KanbanCard }` — full updated card on any state change. |
| `agent-log-appended`   | `{ "cardId", "runId", "line" }` — one stdout/stderr line. |
| `schedules-updated`    | scheduler changed on disk. |

## Trust model

Plugins run **arbitrary local binaries** with the privileges of the user running
the app — the same trust boundary as the agent presets a user already configures.
Only install plugins you trust. There is no sandbox.
