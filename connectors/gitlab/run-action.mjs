#!/usr/bin/env node
// Post-run action entrypoint (manifest `runAction` — the server spawns this
// file directly, request/response, no `node` prefix; needs the shebang above
// + the executable bit). Reads { type, config, card } on stdin, runs the
// GitLab action (create_mr), prints the result on stdout.
import { runActionFromStdin } from "../_sdk/index.mjs";
import adapter from "./adapter.mjs";

runActionFromStdin(adapter);
