# Myra Agents — Plugins

Open-source plugins for [Myra Agents](https://github.com/Myra-Agents/Myra-Agents).
The core server is a closed binary, but it loads plugins at runtime over a small,
language-agnostic contract — so anyone can extend it without the core source.

A plugin is a folder under `~/.myra-agents/plugins/<name>/` with a
`manifest.json`. Two roles, either or both:

- **Agent provider** — contribute agents (the manifest's `providesAgents`) that
  show up in the card agent picker. See [`agents/echo-agent`](./agents/echo-agent).
- **Event reaction** — subscribe to bus events (`agent-result-changed`, …); the
  core pipes them to your executable's stdin as NDJSON. See
  [`notifications/slack-notify`](./notifications/slack-notify).

## Catalog

Plugins are grouped by purpose. Drop a new plugin in the folder that fits, or add
a folder if none does.

| Group | For | Examples |
|-------|-----|----------|
| [`agents/`](./agents) | agent-provider plugins (contribute agents) | echo-agent |
| [`notifications/`](./notifications) | event reactions that ping a channel (Slack, webhook, email) | slack-notify |
| [`integrations/`](./integrations) | event reactions that sync into another system (trackers, CI, DB, exports) | — |

## Read this first

**[PROTOCOL.md](./PROTOCOL.md)** — the full contract (manifest fields, the event
wire format, the agent-result protocol, trust model).
**[schema/manifest.schema.json](./schema/manifest.schema.json)** — JSON Schema you
can validate your manifest against.

## Quick start

```bash
# try an agent provider
cp -r agents/echo-agent ~/.myra-agents/plugins/echo-agent
chmod +x ~/.myra-agents/plugins/echo-agent/echo-agent
# restart the app → "Echo Agent" appears in the picker
```

## Contributing

PRs adding plugins are welcome. Put it in the matching group folder (above),
keep it small and dependency-free where possible, document its config in a
`README.md`, and validate the manifest against the schema before submitting.

## License

MIT — see [LICENSE](./LICENSE).
