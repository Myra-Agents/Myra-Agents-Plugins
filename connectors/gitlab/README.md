# GitLab connector

Trigger a **patrol** (a `ScheduledTask` with an `eventTrigger`) on a GitLab push,
merge request, or issue — and open a merge request with the patrol's result when
it's done. Works against gitlab.com or any self-hosted instance.

Unlike Gmail, this connector has **no poll loop and no `RULES` config** — the
trigger side is a plain inbound webhook (core-handled, see `PROTOCOL.md`'s
"Role 3"), and matching against a patrol's rules happens **server-side**
(`connector-trigger-binding.md`'s "v2" binding): you configure the rules per
patrol in the schedule editor, not once globally for the whole connector. This
plugin's own config is just connection details.

## Auth (pick one)

**Personal access token — zero setup.** In GitLab: User Settings → Access
Tokens → create one with the `api` scope. Paste it into `GITLAB_TOKEN` in
**Settings → Plugins → gitlab**. Done — no OAuth, no consent screen.

**OAuth (nicer UX, per-instance setup).** Register an Application on your
GitLab instance (User Settings → Applications, or Admin → Applications on a
self-hosted instance) with the `api` scope, then:

```bash
cd ~/.myra-agents/plugins/gitlab
GITLAB_URL=https://gitlab.example.com \
OAUTH_CLIENT_ID=… OAUTH_CLIENT_SECRET=… node connect.mjs
```

A browser opens for consent; the refresh token is stored in the OS keychain
(`myra-connector-gitlab`). Leave `GITLAB_TOKEN` blank — setting it always wins
and skips OAuth entirely (see `../_sdk/oauth.mjs::accessToken`).

## (Optional) Configure the webhook (GitLab side)

Triggers work out of the box by **polling** — no webhook needed. Only set this up
if you want instant (non-polled) delivery and can expose a routable URL.

In your project → Settings → Webhooks → Add webhook:

- **URL**: the URL shown in the gitlab plugin panel
  (`http://<host>:<port>/hooks/gitlab/gitlab`). GitLab can't reach `127.0.0.1`,
  so this needs a routable host.
- **Secret token**: same value as this plugin's `GITLAB_WEBHOOK_SECRET`.
- **Trigger**: Push events, Merge request events, Issues events (whichever you
  want a patrol to react to — anything else GitLab sends to the same URL is
  safely ignored, not matched by any rule).

## Bind it to a patrol

In the patrol editor's Add-Trigger menu, pick **GitLab**, then add rules the
same shape every connector uses (`from` / `subjectContains` / `bodyContains` /
`regex`) — matched against the normalized event: `from` (GitLab username),
`subject` (MR/issue title, or `push to <branch>`), `body` (description /
commit messages), plus GitLab extras (`branch`, `projectId`, `type`). First
matching rule's patrol launches with the event templated into its prompt via
`{{subject}} {{from}} {{id}} {{body}}` (`{{body}}` is fenced as untrusted
data — GitLab content is attacker-reachable, same posture as email).

## The "open a merge request" action

Add the **Open a merge request** action to a patrol (Actions section, schedule
editor). Requires the patrol to run with **"Run in worktree"** enabled — the
action pushes the run's worktree branch and opens a **draft** merge request via
`create_mr`; a draft MR is visible in GitLab but not mergeable until a human
removes "Draft:" from the title. That's the review gate — no separate in-app
confirm step needed.

Config: `projectId` (numeric id or `group/project` path), `targetBranch`
(defaults to the project's default branch), `title`/`description` (templated —
`{{result}}` `{{title}}` `{{card.*}}`, blank falls back to the card's own
title/result).

## Security

Webhook payloads are attacker-reachable, untrusted input steering an
autonomous agent (same posture as `connectors/gmail`). The webhook token is
verified constant-time before anything is parsed; prompts fence the untrusted
body. Prefer per-patrol `requireReview` on rules you're not confident in yet —
held cards land in the board for approval instead of auto-running.

## Verify

```bash
node --check adapter.mjs && node --check gitlab.mjs && node --check normalize.mjs && node --check run-action.mjs

# offline: verify + normalize a fake GitLab merge_request payload, no network
node -e '
  const body = JSON.stringify({ project: { id: 1, path_with_namespace: "g/p" },
    object_attributes: { iid: 5, title: "Fix bug", source_branch: "fix/x", action: "open" },
    user: { username: "alice" } });
  console.log(JSON.stringify({ headers: { "x-gitlab-token": "test", "x-gitlab-event": "Merge Request Hook" }, body }));
' | GITLAB_WEBHOOK_SECRET=test node normalize.mjs
# → {"verified":true,"payload":{"connector":"gitlab","projectId":"1","projectPath":"g/p",
#     "type":"merge_request","id":"5","from":"alice","subject":"Fix bug","body":"",
#     "branch":"fix/x","action":"open"}}

# offline: run the create_mr action handler directly against a fake card (needs a
# real token + project to actually push — this just proves the wiring/errors):
echo '{"type":"create_mr","config":{"projectId":"g/p"},"card":{"title":"t","workingDir":"/tmp/repo","worktreeBranch":"agent/run-x"}}' \
  | GITLAB_TOKEN=glpat-xxx node run-action.mjs
```
