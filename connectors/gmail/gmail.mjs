// Minimal Gmail REST v1 client over fetch. No googleapis dep. The access token
// is injected by the caller (the SDK mints it), so this file is pure transport.
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

async function call(token, path, init = {}) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`gmail ${init.method || "GET"} ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

// List message ids matching a server-side Gmail query (`from:`, `subject:`, text…).
export async function listMessages(token, query, max = 25) {
  const q = new URLSearchParams({ q: query, maxResults: String(max) });
  const res = await call(token, `/messages?${q}`);
  return res.messages || [];
}

// Full message → the common connector event shape (+ Gmail extras kept for send).
export async function getMessage(token, id) {
  const m = await call(token, `/messages/${id}?format=full`);
  const headers = {};
  for (const h of m.payload?.headers || []) headers[h.name.toLowerCase()] = h.value;
  return {
    id: m.id,
    threadId: m.threadId,
    snippet: decodeHtmlEntities(m.snippet || ""),
    from: headers.from || "",
    to: headers.to || "",
    subject: headers.subject || "",
    messageIdHeader: headers["message-id"] || "",
    references: headers.references || "",
    date: headers.date || "",
    body: extractText(m.payload),
  };
}

// Send a plain-text email. If threadId/inReplyTo given, thread the reply.
export async function sendMessage(token, { to, subject, text, threadId, inReplyTo, references }) {
  const lines = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=UTF-8", "MIME-Version: 1.0"];
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references || inReplyTo) lines.push(`References: ${[references, inReplyTo].filter(Boolean).join(" ")}`);
  const raw = Buffer.from(`${lines.join("\r\n")}\r\n\r\n${text}`).toString("base64url");
  return call(token, "/messages/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
  });
}

// Save a plain-text draft (no send). Used by the "draft" action.
export async function createDraft(token, { to, subject, text }) {
  const lines = [`To: ${to || ""}`, `Subject: ${subject || ""}`, "Content-Type: text/plain; charset=UTF-8", "MIME-Version: 1.0"];
  const raw = Buffer.from(`${lines.join("\r\n")}\r\n\r\n${text || ""}`).toString("base64url");
  return call(token, "/drafts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
}

// ---- MIME helpers ----------------------------------------------------------

function extractText(payload) {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return b64(payload.body.data);
  for (const part of payload.parts || []) {
    const t = extractText(part);
    if (t) return t;
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return b64(payload.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}

const b64 = (data) => Buffer.from(data, "base64url").toString("utf8");
const decodeHtmlEntities = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
