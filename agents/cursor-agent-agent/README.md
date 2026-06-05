# cursor-agent-agent

An **agent-provider** plugin: contributes a **"Cursor CLI"** agent backed by the
`cursor-agent` CLI. When a card runs it, the core spawns this wrapper in the card's
working directory; the wrapper hands the task to `cursor-agent -p --force "<task>"`, captures its
output, and writes that back as the card result (`awaiting_review`).

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **Cursor CLI** binary on `PATH` as `cursor-agent`. Install: https://cursor.com/cli (`curl https://cursor.com/install -fsS | bash`).

> Runs unattended with full tool access by default. Only assign it to cards you
> trust. Set `MYRA_AGENT_APPROVAL=safe` for the more restrained tier
> (`cursor-agent -p --force "<task>"`) where this CLI offers one.

## Install

```bash
cp -r agents/cursor-agent-agent ~/.myra-agents/plugins/cursor-agent-agent
chmod +x ~/.myra-agents/plugins/cursor-agent-agent/cursor-agent-agent
# restart the Myra Agents app
```

"Cursor CLI" then appears in the card agent picker (and Settings → Plugins).

## Config

| Env var | Purpose |
|---------|---------|
| `CURSOR_AGENT_AGENT_BIN` | Override the CLI binary (path or name) if `cursor-agent` isn't on `PATH`. |
| `MYRA_AGENT_APPROVAL` | `safe` selects the restrained approval tier; default is full-unattended. |

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/cursor-agent-agent {prompt}"` instead of relying on the shebang.
