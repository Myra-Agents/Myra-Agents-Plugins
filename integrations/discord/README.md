# discord (integration)

A **manifest-only** integration — no executable. The server core's webhook engine
posts to a Discord channel webhook when a card reaches `awaiting_review`,
`waiting_feedback`, or `done`.

## Setup

1. Copy into `~/.myra-agents/plugins/discord` and restart Myra.
2. **Settings → Plugins → discord**: paste the channel webhook URL
   (Server Settings → Integrations → Webhooks), pick the events.

Identical to `../slack/` apart from the payload field (`content` vs `text`).
