// Trigger entrypoint (manifest `exec`). Poll-and-report: no public URL needed —
// polls GitLab for the projects the server says to watch (connector_watch) and
// reports each new merge request / issue / push to the server's connector_event
// rpc, which matches it against every enabled patrol's rules and launches the
// bound patrol. Kept alive by the manifest's `subscribes`; stdin is ignored.
import { runReporter } from "../_sdk/index.mjs";
import adapter from "./adapter.mjs";

runReporter(adapter);
