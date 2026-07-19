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

export async function listIssues(token, baseUrl, projectId, { state = "opened", max = 20 } = {}) {
  const q = new URLSearchParams({ state, per_page: String(max) });
  return call(token, baseUrl, `/projects/${encodeURIComponent(projectId)}/issues?${q}`);
}

export async function getIssue(token, baseUrl, projectId, iid) {
  return call(token, baseUrl, `/projects/${encodeURIComponent(projectId)}/issues/${iid}`);
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
