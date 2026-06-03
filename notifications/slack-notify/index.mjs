#!/usr/bin/env node
// slack-notify — an event-reaction plugin for Myra Agents.
//
// The core runs this process long-lived and writes one JSON frame per line to
// our stdin for every event we subscribed to (here: `agent-result-changed`).
// We POST a short message to a Slack-compatible incoming webhook when a card
// reaches a terminal-ish state. One-way: nothing we print to stdout is parsed
// by the core (it's just captured as `[plugin:slack-notify] …` logs).
//
// Config via env: SLACK_WEBHOOK_URL (required to actually post).

import { createInterface } from "node:readline";

const WEBHOOK = process.env.SLACK_WEBHOOK_URL;
if (!WEBHOOK) {
  console.error("SLACK_WEBHOOK_URL not set — running in log-only mode");
}

// Notify only on these card statuses (skip the noisy in_progress churn).
const NOTIFY_ON = new Set(["awaiting_review", "waiting_feedback", "done"]);

async function post(text) {
  if (!WEBHOOK) {
    console.log(`(would post) ${text}`);
    return;
  }
  try {
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) console.error(`webhook responded ${res.status}`);
  } catch (err) {
    console.error(`webhook failed: ${err.message}`);
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let frame;
  try {
    frame = JSON.parse(line);
  } catch {
    return; // ignore non-JSON
  }
  if (frame.event !== "agent-result-changed") return;

  const card = frame.payload?.card;
  if (!card || !NOTIFY_ON.has(card.status)) return;

  const detail = card.agentResult || card.agentQuestion || "";
  post(`*${card.title}* → ${card.status}${detail ? `\n${detail}` : ""}`);
});

rl.on("close", () => process.exit(0));
