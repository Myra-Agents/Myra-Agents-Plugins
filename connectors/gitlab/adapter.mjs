// GitLab connector adapter. No `poll` — unlike Gmail, the trigger side is a
// core-handled inbound webhook (see manifest.json's `webhooks` + normalize.mjs),
// routed server-side to whichever patrol's `eventTrigger` rules match (the v2
// binding — see ../../../connector-trigger-binding.md). This adapter only
// implements the action side (`create_mr`) + a couple of read-only MCP tools.
// See ../README.md for the adapter contract the shared SDK (../_sdk) drives.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  getProject,
  listIssues,
  getIssue,
  createMergeRequest,
  authenticatedRemote,
  listMergeRequests,
  listIssuesUpdated,
  listPushEvents,
  listProjects,
  listProjectMembers,
} from "./gitlab.mjs";

const execFileAsync = promisify(execFile);

// Page size for the dynamic option pickers (project / author) — the app
// lazy-loads the next page on scroll. `hasMore` is inferred from a full page.
const PAGE_SIZE = 30;

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
    // `api` for the REST calls + MR creation, repository scopes so the OAuth
    // token can push the worktree branch over HTTPS.
    scopes: ["api", "read_repository", "write_repository"],
    authUri: `${baseUrl()}/oauth/authorize`,
    tokenUri: `${baseUrl()}/oauth/token`,
    injectedTokenEnv: "GITLAB_TOKEN",
    // GitLab needs an exact registered redirect URI — pin a fixed loopback port
    // so the shipped Myra OAuth app can register http://localhost:47823/.
    redirectPort: 47823,
  },

  // TRIGGER side (poll). Outbound — no public URL needed. The SDK reporter calls
  // this per watched project (from the server's connector_watch) and reports new
  // items to `connector_event`. `target` = { project, events } from the patrols'
  // trigger config. Deduped by the reporter (id = `mr:<iid>` / `issue:<iid>` /
  // `push:<sha>`), so an item triggers once. A one-hour lookback + dedupe keeps
  // it simple and robust to a missed cycle.
  async pollProject(ctx, target) {
    const token = await ctx.accessToken();
    const base = baseUrl();
    const project = target.project;
    const kinds = target.events?.length ? target.events : ["merge_request", "issue", "push"];
    const since = new Date(Date.now() - 3600_000).toISOString();
    const out = [];
    const guard = async (fn) => {
      try {
        return await fn();
      } catch (e) {
        ctx.log(`poll ${project}:`, e.message);
        return [];
      }
    };

    if (kinds.includes("merge_request")) {
      for (const mr of await guard(() => listMergeRequests(token, base, project, { updatedAfter: since }))) {
        out.push({
          type: "merge_request",
          id: `mr:${mr.iid}`,
          from: mr.author?.username || "",
          subject: mr.title || "",
          body: mr.description || "",
          branch: mr.source_branch || "",
          projectId: String(project),
          action: mr.state || "",
        });
      }
    }
    if (kinds.includes("issue")) {
      for (const is of await guard(() => listIssuesUpdated(token, base, project, { updatedAfter: since }))) {
        out.push({
          type: "issue",
          id: `issue:${is.iid}`,
          from: is.author?.username || "",
          subject: is.title || "",
          body: is.description || "",
          projectId: String(project),
          action: is.state || "",
        });
      }
    }
    if (kinds.includes("push")) {
      for (const ev of await guard(() => listPushEvents(token, base, project, { after: since.slice(0, 10) }))) {
        const pd = ev.push_data || {};
        out.push({
          type: "push",
          id: `push:${pd.commit_to || ev.id}`,
          from: ev.author?.username || ev.author_username || "",
          subject: `push to ${pd.ref || ""}`,
          body: pd.commit_title || "",
          branch: pd.ref || "",
          projectId: String(project),
        });
      }
    }
    return out;
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

  // Dynamic option lists for trigger/action config fields (declared in the
  // manifest via `dynamic: true` + `optionsExec`, or `trigger.ruleOptions` for a
  // rule field). The server proxies a `connector_options { field, search, page,
  // context }` rpc to options.mjs, which calls the handler named for the field.
  // Each returns `{ options: [{value,label}], hasMore }` so the app can lazy-load
  // on scroll. `api`/`read_api` scope already covers all of this — no extra
  // permission beyond what MR creation needs.
  options: {
    // The projects this token can see, for the project picker.
    async project(ctx, { search, page = 1 } = {}) {
      const token = await ctx.accessToken();
      const projects = await listProjects(token, baseUrl(), { search, page, perPage: PAGE_SIZE });
      return {
        options: projects.map((p) => ({
          value: p.path_with_namespace,
          label: p.name_with_namespace || p.path_with_namespace,
        })),
        hasMore: projects.length === PAGE_SIZE,
      };
    },

    // Members of the selected project who can perform the trigger's event kind
    // (from `context.project` + `context.events`), for the Author filter. Push
    // and merge requests need Developer+ (push/branch access); issues are open to
    // any project member. Empty until a project is picked.
    async author(ctx, { search, page = 1, context } = {}) {
      const project = context?.project;
      if (!project) return { options: [], hasMore: false };
      const kind = Array.isArray(context?.events) ? context.events[0] : undefined;
      const minAccessLevel = kind === "issue" ? 10 : 30; // issue: any member; push/MR: Developer+
      const token = await ctx.accessToken();
      const members = await listProjectMembers(token, baseUrl(), project, {
        search,
        page,
        perPage: PAGE_SIZE,
        minAccessLevel,
      });
      return {
        options: members.map((m) => ({
          value: m.username,
          label: m.name ? `${m.name} (@${m.username})` : `@${m.username}`,
        })),
        hasMore: members.length === PAGE_SIZE,
      };
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
