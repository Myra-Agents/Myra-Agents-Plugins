# copilot-agent

An **agent-provider** plugin: contributes a **"GitHub Copilot"** agent backed by the
`copilot` CLI. When a card runs it, the core spawns this wrapper in the card's
working directory; the wrapper hands the task to `copilot -p "<task>" --allow-all-tools`, captures its
output, and writes that back as the card result (`awaiting_review`).

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **GitHub Copilot CLI** on `PATH` as `copilot`. Install the GitHub Copilot CLI and authenticate (`copilot`). `--allow-all-tools` is passed so it runs unattended — only assign to cards you trust.

## Install

```bash
cp -r agents/copilot-agent ~/.myra-agents/plugins/copilot-agent
chmod +x ~/.myra-agents/plugins/copilot-agent/copilot-agent
# restart the Myra Agents app
```

"GitHub Copilot" then appears in the card agent picker (and Settings → Plugins).

## Config

| Env var | Purpose |
|---------|---------|
| `COPILOT_AGENT_BIN` | Override the CLI binary (path or name) if `copilot` isn't on `PATH`. |

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/copilot-agent {prompt}"` instead of relying on the shebang.
