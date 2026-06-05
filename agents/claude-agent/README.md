# claude-agent

An **agent-provider** plugin: contributes a **"Claude Code"** agent backed by the
`claude` CLI. When a card runs it, the core spawns this wrapper in the card's
working directory; the wrapper hands the task to `claude -p "<task>"`, captures its
output, and writes that back as the card result (`awaiting_review`).

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **Claude Code CLI** on `PATH` as `claude`. Install: https://docs.claude.com/claude-code (`npm i -g @anthropic-ai/claude-code`).

## Install

```bash
cp -r agents/claude-agent ~/.myra-agents/plugins/claude-agent
chmod +x ~/.myra-agents/plugins/claude-agent/claude-agent
# restart the Myra Agents app
```

"Claude Code" then appears in the card agent picker (and Settings → Plugins).

## Config

| Env var | Purpose |
|---------|---------|
| `CLAUDE_AGENT_BIN` | Override the CLI binary (path or name) if `claude` isn't on `PATH`. |

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/claude-agent {prompt}"` instead of relying on the shebang.
