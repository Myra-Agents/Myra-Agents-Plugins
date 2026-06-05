# amp-agent

An **agent-provider** plugin: contributes a **"Sourcegraph Amp"** agent backed by the
`amp` CLI. When a card runs it, the core spawns this wrapper in the card's
working directory; the wrapper hands the task to `amp -x --dangerously-allow-all "<task>"`, captures its
output, and writes that back as the card result (`awaiting_review`).

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **Sourcegraph Amp** binary on `PATH` as `amp`. Install: https://ampcode.com/manual (`npm i -g @sourcegraph/amp`).

> Runs unattended with full tool access by default. Only assign it to cards you
> trust. Set `MYRA_AGENT_APPROVAL=safe` for the more restrained tier
> (`amp -x "<task>"`) where this CLI offers one.

## Install

```bash
cp -r agents/amp-agent ~/.myra-agents/plugins/amp-agent
chmod +x ~/.myra-agents/plugins/amp-agent/amp-agent
# restart the Myra Agents app
```

"Sourcegraph Amp" then appears in the card agent picker (and Settings → Plugins).

## Config

| Env var | Purpose |
|---------|---------|
| `AMP_AGENT_BIN` | Override the CLI binary (path or name) if `amp` isn't on `PATH`. |
| `MYRA_AGENT_APPROVAL` | `safe` selects the restrained approval tier; default is full-unattended. |

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/amp-agent {prompt}"` instead of relying on the shebang.
