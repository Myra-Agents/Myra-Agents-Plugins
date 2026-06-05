# opencode-local-agent

A **local-LLM** agent-provider plugin: contributes a **"opencode (local)"** agent that
runs the `opencode` CLI against a **local OpenAI-compatible endpoint** (Ollama by
default) — your global opencode config is never touched. Output is captured and
written back as the card result (`awaiting_review`).

Headless command: `OPENCODE_CONFIG_CONTENT=<ollama cfg> opencode run "<task>" --model ollama/<model>`

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **opencode** binary on `PATH` as `opencode`. Install: https://opencode.ai/docs/providers (`curl -fsSL https://opencode.ai/install | bash`).
- A local model server, e.g. **Ollama** with a coder model pulled
  (`ollama pull qwen2.5-coder`). Any OpenAI-compatible server works (LM Studio,
  vLLM, llama.cpp) via `MYRA_LOCAL_BASE_URL`.

## Config

| Env var | Default | Purpose |
|---------|---------|---------|
| `MYRA_LOCAL_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible endpoint of your local server. |
| `MYRA_LOCAL_MODEL` | `qwen2.5-coder` | Model id to use. |
| `MYRA_LOCAL_API_KEY` | `ollama` | Placeholder key (most local servers ignore it). |
| `OPENCODE_AGENT_BIN` | — | Override the CLI binary if `opencode` isn't on `PATH`. |
| `MYRA_AGENT_APPROVAL` | — | `safe` selects the restrained approval tier; default is full-unattended. |

## Install

```bash
cp -r agents/opencode-local-agent ~/.myra-agents/plugins/opencode-local-agent
chmod +x ~/.myra-agents/plugins/opencode-local-agent/opencode-local-agent
# restart the Myra Agents app
```

"opencode (local)" then appears in the card agent picker (and Settings → Plugins).

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/opencode-local-agent {prompt}"` instead of relying on the shebang.
