# slack (integration)

A **manifest-only** integration — no executable. The server core's webhook engine
posts a message to a Slack incoming webhook when a card reaches
`awaiting_review`, `waiting_feedback`, or `done`.

## Setup

1. Copy this folder into `~/.myra-agents/plugins/slack` (or use the Plugins repo's
   `link-plugins.sh`) and restart Myra.
2. **Settings → Plugins → slack**: paste your Slack incoming webhook URL
   (stored in `settings.json`, shown in plain text) and pick the events.

That's it — the core renders the template and POSTs. Edit `template` in
`manifest.json` to change the message. See `../discord/` for the same shape with a
different payload.
