#!/usr/bin/env node
// Dynamic-options entrypoint (manifest `optionsExec` — the server spawns this
// file directly, request/response, no `node` prefix; needs the shebang above
// + the executable bit). Reads { field, search? } on stdin, calls the adapter's
// options[field] handler (e.g. `project` → the projects this token can see),
// prints [{ value, label }] on stdout. Powers the patrol editor's project
// picker.
import { runOptionsFromStdin } from "../_sdk/index.mjs";
import adapter from "./adapter.mjs";

runOptionsFromStdin(adapter);
