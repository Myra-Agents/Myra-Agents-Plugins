// Event-reaction entrypoint (manifest `exec`). Runs the Gmail adapter on the
// shared connector runtime: poll → match RULES → create+launch an agent, and
// send results back on done.
import { runConnector } from "../_sdk/index.mjs";
import adapter from "./adapter.mjs";

runConnector(adapter);
