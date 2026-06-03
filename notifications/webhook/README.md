# webhook (example, TypeScript)

An **event-reaction** plugin written in **TypeScript**, run by [bun](https://bun.sh)
— no build step (bun executes `.ts` directly). POSTs a compact JSON body to any
webhook when a card reaches `awaiting_review`, `waiting_feedback`, or `done`.

Payload types come from the public [`@myra/shared`](https://github.com/Myra-Agents/Myra-Agents-Shared)
package, so the plugin stays typed against the core's wire shapes.

## Install

```bash
cp -r notifications/webhook ~/.myra-agents/plugins/webhook
cd ~/.myra-agents/plugins/webhook && bun install   # editor types (optional at runtime)
export WEBHOOK_URL="https://example.com/hook"        # in the server's env
# restart the Myra Agents app
```

Requires `bun` on `PATH`. Without `WEBHOOK_URL` it runs in log-only mode.
The `import type` is erased at runtime, so the plugin runs even before
`bun install` — that step only powers editor/typecheck.

## Try it standalone

```bash
echo '{"event":"agent-result-changed","payload":{"card":{"title":"Demo","status":"done","agentResult":"ok"}}}' \
  | bun notifications/webhook/index.ts
```

## JS vs TS

`slack-notify` (this folder's sibling) is the same idea in plain Node `.mjs` —
zero toolchain, copy-and-run. This one trades a `bun` dependency for static types
and `@myra/shared` payload shapes. Plugins are language-agnostic; pick either.
