// Post-run action entrypoint (server invokes: `node run-action.mjs`, request/
// response). Reads { type, config, card } on stdin, runs the Gmail action
// (send / draft), prints the result on stdout.
import { runActionFromStdin } from "../_sdk/index.mjs";
import adapter from "./adapter.mjs";

runActionFromStdin(adapter);
