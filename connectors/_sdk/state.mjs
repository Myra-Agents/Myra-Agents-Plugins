// Tiny JSON-file state: which events we've already handled (dedupe) and a rolling
// window of trigger timestamps (loop guard). Lives in the connector's own dir
// (the exec runs with cwd = the plugin dir), so each connector — and each
// installed instance — keeps its own state with no extra config.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FILE = join(process.cwd(), ".state.json");
const SEEN_CAP = 1000;

function load() {
  try { return JSON.parse(readFileSync(FILE, "utf8")); } catch { return { seen: [], triggers: [] }; }
}
function save(s) {
  writeFileSync(FILE, JSON.stringify(s), { mode: 0o600 });
}

let s = load();

export const hasSeen = (id) => s.seen.includes(id);
export function markSeen(id) {
  s.seen.push(id);
  if (s.seen.length > SEEN_CAP) s.seen = s.seen.slice(-SEEN_CAP);
  save(s);
}

// true if we're still under the per-hour cap (and records the trigger).
export function allowTrigger(maxPerHour) {
  const cutoff = Date.now() - 3_600_000;
  s.triggers = s.triggers.filter((t) => t > cutoff);
  if (s.triggers.length >= maxPerHour) return false;
  s.triggers.push(Date.now());
  save(s);
  return true;
}
