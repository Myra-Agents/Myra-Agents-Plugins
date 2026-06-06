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
| `version`        | string     | semver, informational — the plugin's own release. |
| `minProtocol`    | string     | semver requirement for the **core plugin protocol** (see [Protocol versioning](#protocol-versioning)). Bare version = caret; ranges allowed. Absent = baseline. A separate axis from `version`. |
| `exec`           | string     | executable for the event-reaction role. Relative paths (`./x`) resolve against the plugin dir; bare names (`node`, `python`) resolve on `PATH`. Omit for agent-only plugins. |
| `args`           | string[]   | extra argv passed to `exec`. |
| `subscribes`     | string[]   | bus events to forward to `exec`'s stdin. `["*"]` = all. Empty/absent = no event role. |
| `providesAgents` | AgentPreset[] | agent presets this plugin contributes. |

`AgentPreset`: `{ id, name, binary, argsTemplate, workingDir? }`. `argsTemplate`
**must** contain `{prompt}`. `binary` is path-resolved like `exec` (so a plugin
can ship its own agent executable). See `schema/manifest.schema.json`.

A plugin may fill **either or both** roles.

## Protocol versioning

Two version axes, kept distinct:

- **`version`** — the plugin's *own* release. Informational; the core never reads it.
- **`minProtocol`** — the *contract* the plugin needs. The compatibility gate.

The core implements a single **plugin-protocol** version, bumped on every change
to this contract (MAJOR = breaking, MINOR = backward-compatible addition). The
current protocol is **`1.0.0`**. A plugin declares the lowest it can run against
via `minProtocol`, a **semver requirement**:

```json
{ "name": "slack", "version": "0.2.0", "minProtocol": "1.0.0" }
```

- A **bare version** is treated as **caret** (`"1.0.0"` → `^1.0.0` → `>=1.0.0, <2.0.0`),
  Cargo-style — a plugin built for protocol 1.x shouldn't auto-claim 2.x.
- **Ranges** are allowed: `">=1.2, <3"`, `"^1.0"`.
- **Absent** = no constraint (baseline) — every existing plugin.

If the core **can't satisfy** `minProtocol` (or it's unparseable), the plugin is
**incompatible**: it's still listed in **Settings → Plugins**, flagged with a
"needs newer Myra" badge, but **inert** — its agents don't appear in the picker
and its webhooks/inbound routes/exec don't run. Update Myra to use it.

### Compatibility table

| Protocol | Introduced |
|----------|------------|
| `1.0.0`  | Baseline: agent providers, event reaction, webhooks (outbound/inbound + verify schemes), config fields. |

Bump this table (and `CURRENT_PROTOCOL` in the core) whenever the contract grows
a capability a plugin can depend on.

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

- Named `verify.scheme` values: `hmac-sha256`, `slack`, `stripe`.
- Inbound senders can't reach `127.0.0.1`: use a publicly reachable instance, a
  port-forward/tunnel, or (enrolled) the hub's public webhook URL.

### Escape hatch — `exec`

When a named scheme or `map` can't express a service, add `"exec": "./transform"`.
The core invokes it **request/response** (not long-lived): the raw request
(`{ "headers": {…}, "body": "…" }`) on **stdin**; the plugin replies on **stdout**
with `{ "verified": true, "payload": {…} }` (inbound) or the body to POST
(outbound). Non-zero exit / bad output ⇒ rejected + logged. Config is injected as
env, same as agent binaries.

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
