# opencode-agent

An **agent-provider** plugin: contributes a **"opencode"** agent backed by the
`opencode` CLI. When a card runs it, the core spawns this wrapper in the card's
working directory; the wrapper hands the task to `opencode run "<task>"`, captures its
output, and writes that back as the card result (`awaiting_review`).

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **opencode CLI** on `PATH` as `opencode`. Install: https://opencode.ai (`curl -fsSL https://opencode.ai/install | bash`).

## Install

```bash
cp -r agents/opencode-agent ~/.myra-agents/plugins/opencode-agent
chmod +x ~/.myra-agents/plugins/opencode-agent/opencode-agent
# restart the Myra Agents app
```

"opencode" then appears in the card agent picker (and Settings → Plugins).

## Config

| Env var | Purpose |
|---------|---------|
| `OPENCODE_AGENT_BIN` | Override the CLI binary (path or name) if `opencode` isn't on `PATH`. |

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/opencode-agent {prompt}"` instead of relying on the shebang.
