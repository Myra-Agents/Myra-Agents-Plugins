# qwen-local-agent

A **local-LLM** agent-provider plugin: contributes a **"Qwen Code (local)"** agent that
runs the `qwen` CLI against a **local OpenAI-compatible endpoint** (Ollama by
default) — your global qwen config is never touched. Output is captured and
written back as the card result (`awaiting_review`).

Headless command: `OPENAI_BASE_URL=<base> OPENAI_MODEL=<model> qwen --yolo -p "<task>"`

## Requires

- **Node ≥ 18** on `PATH` (runs the wrapper).
- The **Qwen Code** binary on `PATH` as `qwen`. Install: https://qwenlm.github.io/qwen-code-docs/en/users/configuration/model-providers/ (`npm i -g @qwen-code/qwen-code`).
- A local model server, e.g. **Ollama** with a coder model pulled
  (`ollama pull qwen2.5-coder`). Any OpenAI-compatible server works (LM Studio,
  vLLM, llama.cpp) via `MYRA_LOCAL_BASE_URL`.

## Config

| Env var | Default | Purpose |
|---------|---------|---------|
| `MYRA_LOCAL_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible endpoint of your local server. |
| `MYRA_LOCAL_MODEL` | `qwen2.5-coder` | Model id to use. |
| `MYRA_LOCAL_API_KEY` | `ollama` | Placeholder key (most local servers ignore it). |
| `QWEN_AGENT_BIN` | — | Override the CLI binary if `qwen` isn't on `PATH`. |
| `MYRA_AGENT_APPROVAL` | — | `safe` selects the restrained approval tier; default is full-unattended. |

## Install

```bash
cp -r agents/qwen-local-agent ~/.myra-agents/plugins/qwen-local-agent
chmod +x ~/.myra-agents/plugins/qwen-local-agent/qwen-local-agent
# restart the Myra Agents app
```

"Qwen Code (local)" then appears in the card agent picker (and Settings → Plugins).

On Windows, point the manifest `binary` at `node` with `argsTemplate`
`"<abs path>/qwen-local-agent {prompt}"` instead of relying on the shebang.
