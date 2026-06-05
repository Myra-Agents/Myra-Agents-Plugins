# goose-agent

An **agent-provider** plugin: contributes a **"Goose"** agent backed by the
`goose` CLI. When a card runs it, the core spawns this wrapper in the card's
working directory; the wrapper hands the task to `GOOSE_MODE=auto goose run --text "<task>"`, captures its
output, and writes that back as the card result (`awaiting_review`).

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **Goose** binary on `PATH` as `goose`. Install: https://block.github.io/goose (`see Goose docs`).

> Runs unattended with full tool access by default. Only assign it to cards you
> trust. Set `MYRA_AGENT_APPROVAL=safe` for the more restrained tier
> (`GOOSE_MODE=smart-approve goose run --text "<task>"`) where this CLI offers one.

## Install

```bash
cp -r agents/goose-agent ~/.myra-agents/plugins/goose-agent
chmod +x ~/.myra-agents/plugins/goose-agent/goose-agent
# restart the Myra Agents app
```

"Goose" then appears in the card agent picker (and Settings → Plugins).

## Config

| Env var | Purpose |
|---------|---------|
| `GOOSE_AGENT_BIN` | Override the CLI binary (path or name) if `goose` isn't on `PATH`. |
| `MYRA_AGENT_APPROVAL` | `safe` selects the restrained approval tier; default is full-unattended. |

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/goose-agent {prompt}"` instead of relying on the shebang.
