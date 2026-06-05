# aider-agent

An **agent-provider** plugin: contributes a **"Aider"** agent backed by the
`aider` CLI. When a card runs it, the core spawns this wrapper in the card's
working directory; the wrapper hands the task to `aider --yes-always --message "<task>"`, captures its
output, and writes that back as the card result (`awaiting_review`).

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **Aider** binary on `PATH` as `aider`. Install: https://aider.chat (`python -m pip install aider-install && aider-install`).

> Runs unattended with full tool access by default. Only assign it to cards you
> trust. Set `MYRA_AGENT_APPROVAL=safe` for the more restrained tier
> (`aider --yes-always --message "<task>"`) where this CLI offers one.

## Install

```bash
cp -r agents/aider-agent ~/.myra-agents/plugins/aider-agent
chmod +x ~/.myra-agents/plugins/aider-agent/aider-agent
# restart the Myra Agents app
```

"Aider" then appears in the card agent picker (and Settings → Plugins).

## Config

| Env var | Purpose |
|---------|---------|
| `AIDER_AGENT_BIN` | Override the CLI binary (path or name) if `aider` isn't on `PATH`. |
| `MYRA_AGENT_APPROVAL` | `safe` selects the restrained approval tier; default is full-unattended. |

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/aider-agent {prompt}"` instead of relying on the shebang.
