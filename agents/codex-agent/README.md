# codex-agent

An **agent-provider** plugin: contributes a **"OpenAI Codex CLI"** agent backed by the
`codex` CLI. When a card runs it, the core spawns this wrapper in the card's
working directory; the wrapper hands the task to `codex exec --dangerously-bypass-approvals-and-sandbox "<task>"`, captures its
output, and writes that back as the card result (`awaiting_review`).

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **OpenAI Codex CLI** binary on `PATH` as `codex`. Install: https://developers.openai.com/codex/cli (`npm i -g @openai/codex`).

> Runs unattended with full tool access by default. Only assign it to cards you
> trust. Set `MYRA_AGENT_APPROVAL=safe` for the more restrained tier
> (`codex exec --full-auto "<task>"`) where this CLI offers one.

## Install

```bash
cp -r agents/codex-agent ~/.myra-agents/plugins/codex-agent
chmod +x ~/.myra-agents/plugins/codex-agent/codex-agent
# restart the Myra Agents app
```

"OpenAI Codex CLI" then appears in the card agent picker (and Settings → Plugins).

## Config

| Env var | Purpose |
|---------|---------|
| `CODEX_AGENT_BIN` | Override the CLI binary (path or name) if `codex` isn't on `PATH`. |
| `MYRA_AGENT_APPROVAL` | `safe` selects the restrained approval tier; default is full-unattended. |

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/codex-agent {prompt}"` instead of relying on the shebang.
