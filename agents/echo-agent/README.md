# echo-agent (example)

An **agent-provider** plugin: contributes an "Echo Agent" that echoes the task
back and marks the card `awaiting_review`. Useful to verify the plugin → agent
pipeline without a real CLI agent installed.

## Install

```bash
cp -r agents/echo-agent ~/.myra-agents/plugins/echo-agent
chmod +x ~/.myra-agents/plugins/echo-agent/echo-agent
# restart the Myra Agents app
```

"Echo Agent" then appears in the card agent picker (and Settings → Plugins).
Assign it to a card and launch — the card moves to *Awaiting Review* with the
echoed prompt.

Requires Node ≥ 18 on `PATH`. On Windows, point the manifest `binary` at
`node` with `argsTemplate` `"<abs path>/echo-agent {prompt}"` instead of relying
on the shebang.
