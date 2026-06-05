# droid-agent

An **agent-provider** plugin: contributes a **"Factory Droid"** agent backed by the
`droid` CLI. When a card runs it, the core spawns this wrapper in the card's
working directory; the wrapper hands the task to `droid exec --auto high "<task>"`, captures its
output, and writes that back as the card result (`awaiting_review`).

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **Factory Droid** binary on `PATH` as `droid`. Install: https://docs.factory.ai/cli (`see Factory docs`).

> Runs unattended with full tool access by default. Only assign it to cards you
> trust. Set `MYRA_AGENT_APPROVAL=safe` for the more restrained tier
> (`droid exec --auto medium "<task>"`) where this CLI offers one.

## Install

```bash
cp -r agents/droid-agent ~/.myra-agents/plugins/droid-agent
chmod +x ~/.myra-agents/plugins/droid-agent/droid-agent
# restart the Myra Agents app
```

"Factory Droid" then appears in the card agent picker (and Settings → Plugins).

## Config

| Env var | Purpose |
|---------|---------|
| `DROID_AGENT_BIN` | Override the CLI binary (path or name) if `droid` isn't on `PATH`. |
| `MYRA_AGENT_APPROVAL` | `safe` selects the restrained approval tier; default is full-unattended. |

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/droid-agent {prompt}"` instead of relying on the shebang.
