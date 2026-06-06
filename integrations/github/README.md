# github (integration)

A **manifest-only inbound** integration — no executable. The server core exposes a
signed HTTP route; a GitHub webhook POSTs to it and a card is created.

## Setup

1. Copy into `~/.myra-agents/plugins/github` and restart Myra.
2. **Settings → Plugins → github**: set a `GH_SECRET` (any random string).
3. In your GitHub repo → Settings → Webhooks → Add webhook:
   - **Payload URL**: the URL shown in the github plugin panel
     (`http://<host>:<port>/hooks/github/github`, or the hub public URL when
     enrolled).
   - **Content type**: `application/json`.
   - **Secret**: the same `GH_SECRET`.
   - Choose the events (e.g. Pull requests).

The core verifies `X-Hub-Signature-256` (HMAC-SHA256) and creates a card from the
mapped `title`/`body`. Wrong signature → `401`, no card.

> **Reachability:** GitHub can't reach `127.0.0.1`. Use a publicly reachable
> instance, a tunnel/port-forward, or the hub's public webhook URL.

To handle a payload shape the `map` JSONPaths can't express, add an `exec`
transform to the webhook spec (see `PROTOCOL.md` → Escape hatch).
