# q-agent

An **agent-provider** plugin: contributes a **"Amazon Q Developer"** agent backed by the
`q` CLI. When a card runs it, the core spawns this wrapper in the card's
working directory; the wrapper hands the task to `q chat --no-interactive --trust-all-tools "<task>"`, captures its
output, and writes that back as the card result (`awaiting_review`).

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **Amazon Q Developer** binary on `PATH` as `q`. Install: https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line.html (`see AWS docs`).

> Runs unattended with full tool access by default. Only assign it to cards you
> trust. Set `MYRA_AGENT_APPROVAL=safe` for the more restrained tier
> (`q chat --no-interactive "<task>"`) where this CLI offers one.

## Install

```bash
cp -r agents/q-agent ~/.myra-agents/plugins/q-agent
chmod +x ~/.myra-agents/plugins/q-agent/q-agent
# restart the Myra Agents app
```

"Amazon Q Developer" then appears in the card agent picker (and Settings → Plugins).

## Config

| Env var | Purpose |
|---------|---------|
| `Q_AGENT_BIN` | Override the CLI binary (path or name) if `q` isn't on `PATH`. |
| `MYRA_AGENT_APPROVAL` | `safe` selects the restrained approval tier; default is full-unattended. |

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/q-agent {prompt}"` instead of relying on the shebang.
