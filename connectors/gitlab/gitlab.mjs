// Minimal GitLab REST v4 client over fetch. No deps. The access token (OAuth or
// a plain PAT — see adapter.mjs) is injected by the caller, so this file is pure
// transport. Works against gitlab.com or any self-hosted instance: every call
// takes `baseUrl` explicitly instead of hardcoding a host.
const api = (baseUrl) => `${baseUrl.replace(/\/$/, "")}/api/v4`;

async function call(token, baseUrl, path, init = {}) {
  const r = await fetch(`${api(baseUrl)}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`gitlab ${init.method || "GET"} ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

// `projectId` is either the numeric id or a URL-encoded `group/project` path —
// GitLab's API accepts both interchangeably as `:id`.
export async function getProject(token, baseUrl, projectId) {
  return call(token, baseUrl, `/projects/${encodeURIComponent(projectId)}`);
}

// The account the token belongs to — for showing "Connected as @user".
export async function getCurrentUser(token, baseUrl) {
  return call(token, baseUrl, `/user`);
}

export async function listIssues(token, baseUrl, projectId, { state = "opened", max = 20 } = {}) {
  const q = new URLSearchParams({ state, per_page: String(max) });
  return call(token, baseUrl, `/projects/${encodeURIComponent(projectId)}/issues?${q}`);
}

export async function getIssue(token, baseUrl, projectId, iid) {
  return call(token, baseUrl, `/projects/${encodeURIComponent(projectId)}/issues/${iid}`);
}

// ── Polling (the outbound, no-public-URL trigger path) ───────────────────────
// All three take a since cursor and return recent items, newest first.

export async function listMergeRequests(token, baseUrl, projectId, { updatedAfter, max = 20 } = {}) {
  const q = new URLSearchParams({ order_by: "updated_at", sort: "desc", per_page: String(max) });
  if (updatedAfter) q.set("updated_after", updatedAfter);
  return call(token, baseUrl, `/projects/${encodeURIComponent(projectId)}/merge_requests?${q}`);
}

export async function listIssuesUpdated(token, baseUrl, projectId, { updatedAfter, max = 20 } = {}) {
  const q = new URLSearchParams({ order_by: "updated_at", sort: "desc", per_page: String(max) });
  if (updatedAfter) q.set("updated_after", updatedAfter);
  return call(token, baseUrl, `/projects/${encodeURIComponent(projectId)}/issues?${q}`);
}

// GitLab's events `after` is a plain date (YYYY-MM-DD), so this is coarse — the
// caller dedupes by commit sha to avoid re-reporting within the day.
export async function listPushEvents(token, baseUrl, projectId, { after, max = 20 } = {}) {
  const q = new URLSearchParams({ action: "pushed", per_page: String(max) });
  if (after) q.set("after", after);
  return call(token, baseUrl, `/projects/${encodeURIComponent(projectId)}/events?${q}`);
}

// Projects the token can access — for the project picker. `read_api`/`api` covers
// it. Paginated (1-based `page`, `perPage` items) so the app can lazy-load on
// scroll.
export async function listProjects(token, baseUrl, { search, page = 1, perPage = 30 } = {}) {
  const q = new URLSearchParams({
    membership: "true",
    order_by: "last_activity_at",
    simple: "true",
    per_page: String(perPage),
    page: String(page),
  });
  if (search) q.set("search", search);
  return call(token, baseUrl, `/projects?${q}`);
}

// Members of a project (direct + inherited group members) — for the author
// picker. `minAccessLevel` filters to those who can actually perform the event
// (GitLab levels: Guest 10, Reporter 20, Developer 30, Maintainer 40, Owner 50).
// `/members/all` includes inherited members, so a group's developers show up on
// each project. Paginated like `listProjects`.
export async function listProjectMembers(
  token,
  baseUrl,
  projectId,
  { search, page = 1, perPage = 30, minAccessLevel } = {},
) {
  const q = new URLSearchParams({ per_page: String(perPage), page: String(page) });
  if (search) q.set("query", search);
  if (minAccessLevel) q.set("min_access_level", String(minAccessLevel));
  return call(token, baseUrl, `/projects/${encodeURIComponent(projectId)}/members/all?${q}`);
}

// GitLab has no separate "draft" boolean on create — a `Draft: ` title prefix is
// the documented mechanism (still honored by every current GitLab version) and
// is what marks the MR not-mergeable until a maintainer removes it.
export async function createMergeRequest(
  token,
  baseUrl,
  projectId,
  { sourceBranch, targetBranch, title, description, draft },
) {
  const body = {
    source_branch: sourceBranch,
    target_branch: targetBranch,
    title: draft ? `Draft: ${title}` : title,
    description: description || "",
  };
  return call(token, baseUrl, `/projects/${encodeURIComponent(projectId)}/merge_requests`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Embed the token into the project's HTTPS clone URL so a plain `git push`
// works without a credential helper. GitLab accepts any username paired with a
// PAT or an OAuth access token as the password — `oauth2` is the convention
// GitLab's own docs use for both token kinds.
export function authenticatedRemote(httpUrlToRepo, token) {
  const u = new URL(httpUrlToRepo);
  u.username = "oauth2";
  u.password = token;
  return u.toString();
}
