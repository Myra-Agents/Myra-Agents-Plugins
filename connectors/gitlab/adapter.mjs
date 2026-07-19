// GitLab connector adapter. No `poll` — unlike Gmail, the trigger side is a
// core-handled inbound webhook (see manifest.json's `webhooks` + normalize.mjs),
// routed server-side to whichever patrol's `eventTrigger` rules match (the v2
// binding — see ../../../connector-trigger-binding.md). This adapter only
// implements the action side (`create_mr`) + a couple of read-only MCP tools.
// See ../README.md for the adapter contract the shared SDK (../_sdk) drives.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { getProject, listIssues, getIssue, createMergeRequest, authenticatedRemote } from "./gitlab.mjs";

const execFileAsync = promisify(execFile);

function baseUrl() {
  return (process.env.GITLAB_URL || "https://gitlab.com").replace(/\/$/, "");
}

const adapter = {
  id: "gitlab",

  // Desktop OAuth, scope `api` (needed to open merge requests). Self-hosted
  // instances build their own authorize/token URIs from GITLAB_URL — nothing
  // hardcoded to gitlab.com. `injectedTokenEnv` doubles as the PAT escape
  // hatch: the SDK's accessToken() (../_sdk/oauth.mjs) returns GITLAB_TOKEN
  // verbatim when set, skipping OAuth entirely — one adapter, two auth paths.
  auth: {
    scopes: ["api"],
    authUri: `${baseUrl()}/oauth/authorize`,
    tokenUri: `${baseUrl()}/oauth/token`,
    injectedTokenEnv: "GITLAB_TOKEN",
  },

  // Post-run action (declared in manifest catalog.actions). `config` is already
  // resolved + templated by the server; `card` is the finished card, including
  // `worktreeBranch` (set by the server when the patrol ran with useWorktree)
  // and `workingDir` (the repo the worktree branch lives in — worktrees share
  // one `.git`, so pushing from `workingDir` needs no worktree path at all).
  actions: {
    async create_mr(ctx, { config, card }) {
      const branch = card.worktreeBranch;
      const workingDir = card.workingDir;
      const projectId = config.projectId;
      if (!branch) {
        throw new Error(
          "card has no worktreeBranch — the patrol must run with \"Run in worktree\" enabled for create_mr",
        );
      }
      if (!workingDir) throw new Error("card has no workingDir — nowhere to push the branch from");
      if (!projectId) throw new Error("action config is missing \"projectId\"");

      const token = await ctx.accessToken();
      const project = await getProject(token, baseUrl(), projectId);
      const remote = authenticatedRemote(project.http_url_to_repo, token);
      const targetBranch = config.targetBranch || project.default_branch || "main";

      await execFileAsync("git", ["-C", workingDir, "push", remote, `${branch}:${branch}`]);

      // Always opens as a draft — the user reviews and removes "Draft:" in the
      // GitLab UI before it's mergeable. Locked-in safety default; see
      // connector-trigger-binding.md's "Safety" section.
      const mr = await createMergeRequest(token, baseUrl(), projectId, {
        sourceBranch: branch,
        targetBranch,
        title: config.title || card.title || `Myra patrol: ${branch}`,
        description: config.description || card.agentResult || "",
        draft: true,
      });
      ctx.log(`opened draft MR !${mr.iid} → ${mr.web_url}`);
      return { mrIid: mr.iid, mrUrl: mr.web_url, draft: true };
    },
  },

  // "Invoke gitlab from the prompt" — MCP tools the agent can call mid-run to
  // read the issue/MR context that triggered it.
  tools: [
    {
      name: "gitlab_list_issues",
      description: "List open issues for a GitLab project (numeric id or URL-encoded group/project path).",
      inputSchema: {
        type: "object",
        properties: { projectId: { type: "string" }, state: { type: "string" }, max: { type: "number" } },
        required: ["projectId"],
      },
      async handler(args, ctx) {
        const token = await ctx.accessToken();
        return listIssues(token, baseUrl(), args.projectId, { state: args.state, max: args.max });
      },
    },
    {
      name: "gitlab_get_issue",
      description: "Fetch one GitLab issue by project + internal id (iid).",
      inputSchema: {
        type: "object",
        properties: { projectId: { type: "string" }, iid: { type: "number" } },
        required: ["projectId", "iid"],
      },
      async handler(args, ctx) {
        const token = await ctx.accessToken();
        return getIssue(token, baseUrl(), args.projectId, args.iid);
      },
    },
  ],
};

export default adapter;
