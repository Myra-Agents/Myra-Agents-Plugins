# goose-local-agent

A **local-LLM** agent-provider plugin: contributes a **"Goose (local)"** agent that
runs the `goose` CLI against a **local OpenAI-compatible endpoint** (Ollama by
default) — your global goose config is never touched. Output is captured and
written back as the card result (`awaiting_review`).

Headless command: `GOOSE_PROVIDER=ollama GOOSE_MODEL=<model> OLLAMA_HOST=<host> goose run --text "<task>"`

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **Goose** binary on `PATH` as `goose`. Install: https://docs.ollama.com/integrations/goose (`see Goose docs`).
- A local model server, e.g. **Ollama** with a coder model pulled
  (`ollama pull qwen2.5-coder`). Any OpenAI-compatible server works (LM Studio,
  vLLM, llama.cpp) via `MYRA_LOCAL_BASE_URL`.

## Config

| Env var | Default | Purpose |
|---------|---------|---------|
| `MYRA_LOCAL_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible endpoint of your local server. |
| `MYRA_LOCAL_MODEL` | `qwen2.5-coder` | Model id to use. |
| `MYRA_LOCAL_API_KEY` | `ollama` | Placeholder key (most local servers ignore it). |
| `GOOSE_AGENT_BIN` | — | Override the CLI binary if `goose` isn't on `PATH`. |
| `MYRA_AGENT_APPROVAL` | — | `safe` selects the restrained approval tier; default is full-unattended. |

## Install

```bash
cp -r agents/goose-local-agent ~/.myra-agents/plugins/goose-local-agent
chmod +x ~/.myra-agents/plugins/goose-local-agent/goose-local-agent
# restart the Myra Agents app
```

"Goose (local)" then appears in the card agent picker (and Settings → Plugins).

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/goose-local-agent {prompt}"` instead of relying on the shebang.
