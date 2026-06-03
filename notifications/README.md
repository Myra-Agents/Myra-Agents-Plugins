# notifications/

**Event-reaction** plugins that notify an external channel — Slack, webhooks,
email, desktop toasts. They subscribe to bus events; the core pipes matching
frames to the plugin's stdin as NDJSON.

See [PROTOCOL.md](../PROTOCOL.md#role-2--event-reaction).

| Plugin | Reacts to | What it does |
|--------|-----------|--------------|
| [slack-notify](./slack-notify) | `agent-result-changed` | Posts to a Slack webhook when a card reaches awaiting-review / waiting-feedback / done. |
