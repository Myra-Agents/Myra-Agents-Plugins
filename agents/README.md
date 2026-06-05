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
