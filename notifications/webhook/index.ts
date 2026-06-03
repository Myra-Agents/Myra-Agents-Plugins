#!/usr/bin/env bun
// webhook — a TypeScript event-reaction plugin for Myra Agents, run by bun
// (no build step — bun executes .ts directly; the `import type` is erased at
// runtime). POSTs a compact JSON body to any webhook when a card reaches a
// terminal-ish state.
//
// Payload types come from the public @myra/shared package, so the plugin stays
// in lockstep with the core's wire shapes. `bun install` once for editor types;
// runtime needs only `bun` + WEBHOOK_URL.

import { createInterface } from "node:readline";
import type { KanbanCard } from "@myra/shared";

/** One NDJSON frame the core writes to our stdin. */
interface EventFrame {
  event: string;
  payload: { card?: KanbanCard };
}

const WEBHOOK = process.env.WEBHOOK_URL;
if (!WEBHOOK) console.error("WEBHOOK_URL not set — running in log-only mode");

const NOTIFY_ON: ReadonlySet<KanbanCard["status"]> = new Set([
  "awaiting_review",
  "waiting_feedback",
  "done",
]);

async function post(card: KanbanCard): Promise<void> {
  const body = {
    title: card.title,
    status: card.status,
    detail: card.agentResult ?? card.agentQuestion ?? null,
  };
  if (!WEBHOOK) {
    console.log(`(would post) ${JSON.stringify(body)}`);
    return;
  }
  try {
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error(`webhook responded ${res.status}`);
  } catch (err) {
    console.error(`webhook failed: ${(err as Error).message}`);
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line: string) => {
  if (!line.trim()) return;
  let frame: EventFrame;
  try {
    frame = JSON.parse(line) as EventFrame;
  } catch {
    return;
  }
  if (frame.event !== "agent-result-changed") return;
  const card = frame.payload?.card;
  if (card && NOTIFY_ON.has(card.status)) void post(card);
});

rl.on("close", () => process.exit(0));
