# Gmail connector

Trigger an agent when mail arrives, email results back, and expose Gmail as MCP
tools — built on the shared [connector SDK](../README.md). Zero npm deps.

## Auth (once)

OAuth2 desktop flow, scopes `gmail.readonly` + `gmail.send`:

```bash
cd ~/.myra-agents/plugins/gmail
OAUTH_CLIENT_ID=… OAUTH_CLIENT_SECRET=… node connect.mjs
```

A browser opens for consent; the refresh token is stored in the OS keychain
(`myra-connector-gmail`). App-brokered token? Set `GOOGLE_ACCESS_TOKEN` and the
connector skips its own OAuth.

Shipped client shows an "unverified app" screen + 100-user cap until Google CASA
verification lands (a parallel, non-code track). Or bring your own Google Cloud
Desktop client via the two config values.

## Configure (Settings → Plugins → gmail)

Gmail-specific: `GMAIL_QUERY` (server-side prefilter). Everything else
(`RULES`, `REQUIRE_REVIEW`, `DRY_RUN`, `AGENT_PRESET_ID`, …) is the shared
connector config — see [../README.md](../README.md).

`RULES` example:

```json
[
  { "name": "invoices", "from": "billing@acme.com", "regex": "INV-\\d{6}",
    "regexField": "subject", "agentId": "claude",
    "prompt": "Extract the invoice number and amount from {{subject}}:\n\n{{body}}" }
]
```

Prompt placeholders: `{{subject}} {{from}} {{snippet}} {{id}} {{body}}`
(`{{body}}` is fenced as untrusted data).

## Security

Email is attacker-reachable, untrusted input steering an autonomous agent.
`DRY_RUN` + `REQUIRE_REVIEW` default ON; self-mail is skipped, events are
de-duped, triggers are capped per hour, and the body is fenced. Prefer
"draft, don't send" prompts.

## Verify

```bash
node --check reactor.mjs && node --check mcp.mjs
# offline pipeline test (needs a running server + an `echo` agent):
RULES='[{"name":"t","subjectContains":"MYRA TEST","prompt":"New: {{subject}}\n{{body}}"}]' \
FAKE_EVENT='{"from":"a@b.com","subject":"MYRA TEST","body":"hi","id":"x1"}' \
DRY_RUN=false REQUIRE_REVIEW=false AGENT_PRESET_ID=echo node reactor.mjs
```
