// Gmail connector adapter. Everything Gmail-specific lives here; the shared SDK
// (../_sdk) does the poll loop, rule matching, card creation, send-on-done,
// dedupe, safety rails, MCP host and OAuth. See ../_sdk/index.mjs for the
// adapter contract.
import { createDraft, listMessages, getMessage, sendMessage } from "./gmail.mjs";

const adapter = {
  id: "gmail",

  // Desktop OAuth: readonly + send. Auth/token URIs default to Google in the SDK.
  auth: {
    scopes: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"],
    injectedTokenEnv: "GOOGLE_ACCESS_TOKEN", // app-brokered token, if present
  },

  // Fetch unread mail matching the server-side query; each message is already the
  // common event shape (id/from/subject/body/snippet + Gmail extras).
  async poll(ctx) {
    const token = await ctx.accessToken();
    const query = process.env.GMAIL_QUERY || "is:unread newer_than:1d";
    const ids = await listMessages(token, query, 25);
    const events = [];
    for (const { id } of ids) events.push(await getMessage(token, id));
    return events;
  },

  // Never react to our own outbound mail.
  isSelfSent: (e) => /no-?reply/i.test(e.from),

  // Reply into the originating thread when the card came from an email
  // (the built-in send-on-done path).
  async send(ctx, { to, subject, text, event }) {
    const token = await ctx.accessToken();
    await sendMessage(token, { to, subject, text, threadId: event?.threadId, inReplyTo: event?.messageIdHeader });
  },

  // Post-run actions (declared in manifest catalog.actions). `config` is already
  // resolved + templated by the SDK; `card` is the finished card.
  actions: {
    async send(ctx, { config }) {
      const token = await ctx.accessToken();
      await sendMessage(token, { to: config.to, subject: config.subject || "(no subject)", text: config.body || "" });
      return { sent: true };
    },
    async draft(ctx, { config }) {
      const token = await ctx.accessToken();
      const res = await createDraft(token, { to: config.to, subject: config.subject, text: config.body });
      return { draftId: res.id };
    },
  },

  // "Invoke gmail from the prompt" — MCP tools the agent can call.
  tools: [
    {
      name: "gmail_search",
      description: "Search the connected Gmail with a Gmail query (from:, subject:, has-text, label:, newer_than:).",
      inputSchema: { type: "object", properties: { query: { type: "string" }, max: { type: "number" } }, required: ["query"] },
      async handler(args, ctx) {
        const token = await ctx.accessToken();
        const ids = await listMessages(token, args.query, args.max || 10);
        const out = [];
        for (const { id } of ids) {
          const m = await getMessage(token, id);
          out.push({ id: m.id, from: m.from, subject: m.subject, snippet: m.snippet, date: m.date, threadId: m.threadId });
        }
        return out;
      },
    },
    {
      name: "gmail_get",
      description: "Fetch one Gmail message by id: decoded headers, plaintext body, threadId.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      handler: async (args, ctx) => getMessage(await ctx.accessToken(), args.id),
    },
    {
      name: "gmail_send",
      description: "Send a plaintext email. Pass threadId + inReplyTo to reply within a thread.",
      inputSchema: {
        type: "object",
        properties: { to: { type: "string" }, subject: { type: "string" }, text: { type: "string" }, threadId: { type: "string" }, inReplyTo: { type: "string" } },
        required: ["to", "subject", "text"],
      },
      async handler(args, ctx) {
        const res = await sendMessage(await ctx.accessToken(), args);
        return { sent: true, id: res.id, threadId: res.threadId };
      },
    },
  ],
};

export default adapter;
