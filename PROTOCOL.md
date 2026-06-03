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
the whole contract. See `examples/echo-agent/`.

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

See `examples/slack-notify/`.

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
