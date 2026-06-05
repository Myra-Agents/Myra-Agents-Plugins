# codex-local-agent

A **local-LLM** agent-provider plugin: contributes a **"OpenAI Codex CLI (local)"** agent that
runs the `codex` CLI against a **local OpenAI-compatible endpoint** (Ollama by
default) — your global codex config is never touched. Output is captured and
written back as the card result (`awaiting_review`).

Headless command: `codex exec --oss -m <model> --dangerously-bypass-approvals-and-sandbox "<task>"`

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **OpenAI Codex CLI** binary on `PATH` as `codex`. Install: https://developers.openai.com/codex/config-advanced (`npm i -g @openai/codex`).
- A local model server, e.g. **Ollama** with a coder model pulled
  (`ollama pull qwen2.5-coder`). Any OpenAI-compatible server works (LM Studio,
  vLLM, llama.cpp) via `MYRA_LOCAL_BASE_URL`.

> **Codex + custom endpoint:** `--oss` targets Ollama on `:11434` by default. A non-default `MYRA_LOCAL_BASE_URL` (e.g. LM Studio) currently needs a `~/.codex/config.toml` provider entry — env alone won't redirect it.

## Config

| Env var | Default | Purpose |
|---------|---------|---------|
| `MYRA_LOCAL_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible endpoint of your local server. |
| `MYRA_LOCAL_MODEL` | `qwen2.5-coder` | Model id to use. |
| `MYRA_LOCAL_API_KEY` | `ollama` | Placeholder key (most local servers ignore it). |
| `CODEX_AGENT_BIN` | — | Override the CLI binary if `codex` isn't on `PATH`. |
| `MYRA_AGENT_APPROVAL` | — | `safe` selects the restrained approval tier; default is full-unattended. |

## Install

```bash
cp -r agents/codex-local-agent ~/.myra-agents/plugins/codex-local-agent
chmod +x ~/.myra-agents/plugins/codex-local-agent/codex-local-agent
# restart the Myra Agents app
```

"OpenAI Codex CLI (local)" then appears in the card agent picker (and Settings → Plugins).

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/codex-local-agent {prompt}"` instead of relying on the shebang.
