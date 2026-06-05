# TODO — more agent-provider plugins

The `agents/` directory ships wrappers for the established coding-agent CLIs
(claude, copilot, opencode, gemini, codex, aider, cursor-agent, q, goose, crush,
amp, qwen, droid). The agents below are **candidates not yet implemented** — each
needs its headless one-shot invocation **and** an auto-approve path verified
before it lands, so a card can run it unattended and the wrapper can capture
output into the result JSON (see [PROTOCOL.md](./PROTOCOL.md#role-1--agent-provider)
and any existing `agents/*-agent` as the template).

## Candidates (verify invocation + auto-approve, then add)

| Agent | Binary | Headless one-shot (to confirm) | Auto-approve (to confirm) | Notes |
|-------|--------|-------------------------------|---------------------------|-------|
| Continue CLI | `cn` | `cn -p "<task>"` (headless confirmed) | **unknown** — no documented yolo flag found | Add once the unattended-approval story is clear; may need a config/policy file. |
| OpenHands | `openhands` | CLI/headless exists | needs confirmation | Heavier setup (often Docker-backed); confirm a single-shot, no-confirm path. |
| Plandex | `plandex` | multi-step; `--no-tui`? | needs confirmation | Plan/apply model differs from one-shot; map it onto the result protocol carefully. |
| Open Interpreter | `interpreter` | `interpreter -y "<task>"` | `-y` / `--auto-run` | General-purpose (not code-only); confirm it edits the repo rather than just chatting. |
| Cline | `cline` | CLI maturity unclear | needs confirmation | Primarily a VS Code extension; only add if/when a real headless CLI ships. |
| Pi | `pi` | needs confirmation | needs confirmation | Niche; low priority. |

### Not viable as a local wrapper (skip)

- **Warp** — a proprietary terminal, not a scriptable single-shot agent binary.
- **Devin** (Cognition) — web/cloud only; no local CLI to wrap.

## Pattern for adding one

1. Confirm: `<bin>` non-interactive one-shot flag + the flag/env that auto-approves
   all tools (yolo) and, if it exists, a restrained tier for `MYRA_AGENT_APPROVAL=safe`.
2. Copy an existing `agents/<x>-agent/` (manifest + wrapper + README), swap the
   binary, args, env-override name (`<NAME>_AGENT_BIN`), and install hint.
3. `chmod +x` the wrapper; validate the manifest against
   `schema/manifest.schema.json`; add a row to `agents/README.md`.

## Unrelated follow-up (host side, private server repo)

Plugin-contributed presets show a **delete** affordance in Settings even though
deleting is a no-op (discovery re-adds them; the real action is uninstalling the
plugin). Fix host-side by flagging preset `source: "plugin"` in the server
payload so the app can hide delete for them.
