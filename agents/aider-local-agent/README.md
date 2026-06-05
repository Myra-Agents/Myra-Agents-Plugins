# aider-local-agent

A **local-LLM** agent-provider plugin: contributes a **"Aider (local)"** agent that
runs the `aider` CLI against a **local OpenAI-compatible endpoint** (Ollama by
default) — your global aider config is never touched. Output is captured and
written back as the card result (`awaiting_review`).

Headless command: `OLLAMA_API_BASE=<host> aider --model ollama_chat/<model> --yes-always --message "<task>"`

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **Aider** binary on `PATH` as `aider`. Install: https://aider.chat/docs/llms/ollama.html (`python -m pip install aider-install && aider-install`).
- A local model server, e.g. **Ollama** with a coder model pulled
  (`ollama pull qwen2.5-coder`). Any OpenAI-compatible server works (LM Studio,
  vLLM, llama.cpp) via `MYRA_LOCAL_BASE_URL`.

## Config

| Env var | Default | Purpose |
|---------|---------|---------|
| `MYRA_LOCAL_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible endpoint of your local server. |
| `MYRA_LOCAL_MODEL` | `qwen2.5-coder` | Model id to use. |
| `MYRA_LOCAL_API_KEY` | `ollama` | Placeholder key (most local servers ignore it). |
| `AIDER_AGENT_BIN` | — | Override the CLI binary if `aider` isn't on `PATH`. |
| `MYRA_AGENT_APPROVAL` | — | `safe` selects the restrained approval tier; default is full-unattended. |

## Install

```bash
cp -r agents/aider-local-agent ~/.myra-agents/plugins/aider-local-agent
chmod +x ~/.myra-agents/plugins/aider-local-agent/aider-local-agent
# restart the Myra Agents app
```

"Aider (local)" then appears in the card agent picker (and Settings → Plugins).

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/aider-local-agent {prompt}"` instead of relying on the shebang.
