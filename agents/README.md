# agents/

**Agent-provider** plugins — they contribute agents (the manifest's
`providesAgents`) that appear in the card agent picker. When a card runs one, the
core spawns the plugin's own `binary`. No live IPC; the manifest is the whole
contract.

See [PROTOCOL.md](../PROTOCOL.md#role-1--agent-provider).

| Plugin | What it does |
|--------|--------------|
| [echo-agent](./echo-agent) | Echoes the task back and marks the card awaiting-review. Smoke test for the agent pipeline. |
| [claude-agent](./claude-agent) | Runs the task with the [Claude Code](https://docs.claude.com/claude-code) CLI (`claude -p`). |
| [copilot-agent](./copilot-agent) | Runs the task with the GitHub Copilot CLI (`copilot -p`). |
| [opencode-agent](./opencode-agent) | Runs the task with the [opencode](https://opencode.ai) CLI (`opencode run`). |
| [gemini-agent](./gemini-agent) | Runs the task with the [Gemini CLI](https://geminicli.com) (`gemini --yolo -p`). |
| [codex-agent](./codex-agent) | Runs the task with the [OpenAI Codex CLI](https://developers.openai.com/codex/cli) (`codex exec`). |
| [aider-agent](./aider-agent) | Runs the task with [Aider](https://aider.chat) (`aider --yes-always --message`). |
| [cursor-agent-agent](./cursor-agent-agent) | Runs the task with the [Cursor CLI](https://cursor.com/cli) (`cursor-agent -p --force`). |
| [q-agent](./q-agent) | Runs the task with the [Amazon Q Developer CLI](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line.html) (`q chat --no-interactive --trust-all-tools`). |
| [goose-agent](./goose-agent) | Runs the task with [Goose](https://block.github.io/goose) (`GOOSE_MODE=auto goose run --text`). |
| [crush-agent](./crush-agent) | Runs the task with [Crush](https://github.com/charmbracelet/crush) (`crush run --yolo`). |
| [amp-agent](./amp-agent) | Runs the task with [Sourcegraph Amp](https://ampcode.com/manual) (`amp -x --dangerously-allow-all`). |
| [qwen-agent](./qwen-agent) | Runs the task with [Qwen Code](https://github.com/QwenLM/qwen-code) (`qwen --yolo -p`). |
| [droid-agent](./droid-agent) | Runs the task with [Factory Droid](https://docs.factory.ai/cli) (`droid exec --auto`). |

> The CLI-backed agents above run **fully unattended** (auto-approve/yolo) by
> default so cards complete without prompts — only assign one to cards you trust.
> Set `MYRA_AGENT_APPROVAL=safe` to use the CLI's more restrained approval tier
> where it offers one. Each also honours a `<NAME>_AGENT_BIN` binary override;
> see the plugin's own README. Each agent needs its CLI installed separately.

## Local-LLM presets

Same CLIs, but pointed at a **local OpenAI-compatible endpoint** (Ollama by
default) using only env/flags — your global CLI config is never touched. Set
`MYRA_LOCAL_BASE_URL` (default `http://localhost:11434/v1`), `MYRA_LOCAL_MODEL`
(default `qwen2.5-coder`), and `MYRA_LOCAL_API_KEY` (default `ollama`). Needs a
local model server (Ollama / LM Studio / vLLM / llama.cpp) running.

| Plugin | Backs onto | How it targets local |
|--------|-----------|----------------------|
| [opencode-local](./opencode-local-agent) | opencode | injects an Ollama provider via `OPENCODE_CONFIG_CONTENT` + `--model ollama/<model>` |
| [aider-local](./aider-local-agent) | aider | `OLLAMA_API_BASE=<host>` + `--model ollama_chat/<model>` |
| [codex-local](./codex-local-agent) | codex | `codex exec --oss -m <model>` (custom base needs `~/.codex/config.toml`) |
| [qwen-local](./qwen-local-agent) | qwen | `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL` |
| [goose-local](./goose-local-agent) | goose | `GOOSE_PROVIDER=ollama` + `GOOSE_MODEL` + `OLLAMA_HOST` |

Not shipped as local presets: **crush** (needs a provider config file, no clean
env path), **claude** (Anthropic-only; local only via an `ANTHROPIC_BASE_URL`
proxy). See [../TODO.md](../TODO.md).
