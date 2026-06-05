# crush-agent

An **agent-provider** plugin: contributes a **"Crush"** agent backed by the
`crush` CLI. When a card runs it, the core spawns this wrapper in the card's
working directory; the wrapper hands the task to `crush run --yolo "<task>"`, captures its
output, and writes that back as the card result (`awaiting_review`).

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **Crush** binary on `PATH` as `crush`. Install: https://github.com/charmbracelet/crush (`see Crush README`).

> Runs unattended with full tool access by default. Only assign it to cards you
> trust. Set `MYRA_AGENT_APPROVAL=safe` for the more restrained tier
> (`crush run --yolo "<task>"`) where this CLI offers one.

## Install

```bash
cp -r agents/crush-agent ~/.myra-agents/plugins/crush-agent
chmod +x ~/.myra-agents/plugins/crush-agent/crush-agent
# restart the Myra Agents app
```

"Crush" then appears in the card agent picker (and Settings → Plugins).

## Config

| Env var | Purpose |
|---------|---------|
| `CRUSH_AGENT_BIN` | Override the CLI binary (path or name) if `crush` isn't on `PATH`. |
| `MYRA_AGENT_APPROVAL` | `safe` selects the restrained approval tier; default is full-unattended. |

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/crush-agent {prompt}"` instead of relying on the shebang.
