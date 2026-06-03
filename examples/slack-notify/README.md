# slack-notify (example)

An **event-reaction** plugin: posts a Slack message when a card reaches
`awaiting_review`, `waiting_feedback`, or `done`.

## Install

```bash
cp -r examples/slack-notify ~/.myra-agents/plugins/slack-notify
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/…"   # in the server's env
# restart the Myra Agents app
```

Without `SLACK_WEBHOOK_URL` it runs in log-only mode (prints what it *would*
post), so you can verify the wiring first.

## Try it standalone

```bash
echo '{"event":"agent-result-changed","payload":{"card":{"title":"Demo","status":"done","agentResult":"all green"}}}' \
  | node examples/slack-notify/index.mjs
```

Requires Node ≥ 18 (for global `fetch`).
