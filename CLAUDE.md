# Myra Agents — Plugins — Claude Code Instructions

Open-source plugins for [Myra Agents](https://github.com/Myra-Agents/Myra-Agents).
The core server is a closed binary, but it loads plugins at runtime over a small,
**language-agnostic subprocess contract** — so anyone can extend it without the
core source. **Public repo.**

Part of the [Myra-Agents](https://github.com/orgs/Myra-Agents/repositories) org:
app (public) · shared (public) · hub (private) · server (private) ·
**plugins (public, this)**.

## The contract is the product

**[PROTOCOL.md](./PROTOCOL.md) is the source of truth** — manifest fields, the
event wire format, the agent-result protocol, the trust model. Validate every
manifest against **[schema/manifest.schema.json](./schema/manifest.schema.json)**.
If you change how plugins work, PROTOCOL.md + the schema change first; the
matching host code lives in the **private server repo** (`src/plugins.rs`), not
here, so this repo can only describe and exemplify the contract — not break it.

## What a plugin is

A folder under `~/.myra-agents/plugins/<name>/` with a `manifest.json`. Two
roles, either or both:

- **Agent provider** — contributes agents (`providesAgents`) that appear in the
  card agent picker. Resolved as a fallback in the server's
  `runner::resolve_agent_preset`.
- **Event reaction** — `subscribes` to bus events (`agent-result-changed`, …);
  the host runs your executable long-lived and pipes matching frames to its
  **stdin as NDJSON** (respawned with backoff).

## Layout — catalog by purpose

- `agents/` — agent-provider plugins (e.g. `echo-agent`).
- `notifications/` — event reactions that ping a channel (`slack-notify`, webhook).
- `integrations/` — event reactions that sync into another system (trackers, CI, DB).

Drop a new plugin in the folder that fits; add a folder only if none does. Each
group has its own `README.md`.

## Conventions for contributed plugins

- Keep it **small and dependency-free** where possible (it runs as a subprocess
  on a user's machine — respect the trust model in PROTOCOL.md).
- `manifest.json` must validate against the schema. The executable must be
  `chmod +x`.
- Document config in a per-plugin `README.md`.
- Be language-agnostic friendly: the contract is stdin/stdout NDJSON + a JSON
  manifest, not tied to any runtime.

## Verify a plugin before submitting

```bash
# validate the manifest against the schema (any JSON-Schema validator), e.g.
bunx ajv-cli validate -s schema/manifest.schema.json -d <plugin>/manifest.json
# smoke-test: copy into ~/.myra-agents/plugins/ and restart the app
```

No build, no central test suite — plugins are independent. PRs adding plugins
are welcome.
