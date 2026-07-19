#!/usr/bin/env node
// Webhook `exec` escape hatch (PROTOCOL.md's "Role 3 → Escape hatch — exec").
// The server spawns this file directly (request/response, no `node` prefix —
// needs the shebang above + the executable bit). GitLab sends push /
// merge_request / issue payloads with different shapes to
// the *same* URL, discriminated by the X-Gitlab-Event header — the declarative
// `verify` + `map` (JSONPath on the body alone) can't branch on a header, so
// this does the verification + shape-normalizing by hand.
//
// Raw `{ "headers": {...}, "body": "..." }` JSON on stdin (per PROTOCOL.md) →
// `{ "verified": true, "payload": {...} }` (or `{ "verified": false }`) on
// stdout. `payload` becomes the `connector_event` rpc's `input` — the common
// event shape `rules.mjs`-style matching expects: `{ connector, id, from,
// subject, body, ... }` (see ../README.md).
import { timingSafeEqual } from "node:crypto";

async function main() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  let req;
  try {
    req = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {
    process.stdout.write(JSON.stringify({ verified: false }));
    return;
  }

  const headers = lowerKeys(req.headers || {});
  const secret = process.env.GITLAB_WEBHOOK_SECRET || "";
  const token = headers["x-gitlab-token"] || "";
  if (!secret || !ctEq(token, secret)) {
    process.stdout.write(JSON.stringify({ verified: false }));
    return;
  }

  let body;
  try {
    body = JSON.parse(req.body);
  } catch {
    process.stdout.write(JSON.stringify({ verified: false }));
    return;
  }

  const payload = normalize(headers["x-gitlab-event"] || "", body);
  process.stdout.write(JSON.stringify(payload ? { verified: true, payload } : { verified: false }));
}

function normalize(eventKind, body) {
  const project = body.project || {};
  const base = {
    connector: "gitlab",
    projectId: project.id != null ? String(project.id) : "",
    projectPath: project.path_with_namespace || "",
  };

  if (eventKind === "Merge Request Hook") {
    const mr = body.object_attributes || {};
    return {
      ...base,
      type: "merge_request",
      id: String(mr.iid ?? mr.id ?? ""),
      from: body.user?.username || "",
      subject: mr.title || "",
      body: mr.description || "",
      branch: mr.source_branch || "",
      action: mr.action || "",
    };
  }
  if (eventKind === "Issue Hook") {
    const issue = body.object_attributes || {};
    return {
      ...base,
      type: "issue",
      id: String(issue.iid ?? issue.id ?? ""),
      from: body.user?.username || "",
      subject: issue.title || "",
      body: issue.description || "",
      action: issue.action || "",
    };
  }
  if (eventKind === "Push Hook") {
    const branch = (body.ref || "").replace(/^refs\/heads\//, "");
    return {
      ...base,
      type: "push",
      id: body.checkout_sha || body.after || "",
      from: body.user_username || body.user_name || "",
      subject: `push to ${branch}`,
      body: (body.commits || []).map((c) => c.message).join("\n\n"),
      branch,
    };
  }
  // Unrecognized event kind (e.g. Tag Push, Pipeline, Note Hook) — not rejected
  // as unverified (the signature was fine), just unmatched by any rule since
  // there's no card-relevant shape to normalize yet.
  return null;
}

function lowerKeys(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k.toLowerCase()] = v;
  return out;
}

function ctEq(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

main();
