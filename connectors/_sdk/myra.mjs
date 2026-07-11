// Thin client for the local Myra server RPC (`POST /rpc/:cmd`). The webhook
// contract can create a card but has no way to *launch* an agent (launch_agent
// needs the new card id, and an inbound webhook returns {ok,message}, not the
// card). So an "event triggers an agent" connector drives /rpc directly:
//   add_card  → returns the created card (with id)
//   launch_agent {cardId} → runs it
// /rpc is open on localhost unless MYRA_SERVER_TOKEN is set; pass SERVER_TOKEN
// to authenticate when it is.
export function myraClient({ rpcUrl, token }) {
  const base = rpcUrl.replace(/\/$/, "");
  async function rpc(cmd, args) {
    const r = await fetch(`${base}/rpc/${cmd}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(args ?? {}),
    });
    if (!r.ok) throw new Error(`rpc ${cmd} → ${r.status}: ${await r.text()}`);
    const j = await r.json();
    return j && typeof j === "object" && "data" in j ? j.data : j; // /rpc wraps in { data, ok }
  }

  return {
    // Create a board card. Returns the created card (id, status, …).
    addCard: (input) => rpc("add_card", { input }),
    // Launch the agent bound to an existing card. Returns {runId} or {queued}.
    launchAgent: (cardId, workingDir) =>
      rpc("launch_agent", { input: { cardId, ...(workingDir ? { workingDir } : {}) } }),
    ping: () => fetch(`${base}/healthz`).then((r) => r.ok),
  };
}
