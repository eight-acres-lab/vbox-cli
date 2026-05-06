// Per-command session heartbeat.
//
// Every command (except `doctor` / `connect`, which are themselves a
// connect probe) calls `maintainSession()` in the commander preAction
// hook. The function inspects ~/.config/vbox/state.json:
//
//   - cache fresh (last_connect_at within TTL) → no-op, return cached.
//   - cache stale or missing → POST /berry/connect, write new state.
//
// The heartbeat is silent on the happy path (we own stdout for the
// command's JSON output). Anything noisy goes to stderr.
//
// Auth failures (401/403) print a short hint and clear the cached state
// so the next invocation re-probes; the actual command then proceeds and
// fails through its own error path with the precise BCP error.

import { BCPClient, BCPAuthError, BCPError } from "./lib/index.js"
import type { ConnectResponse, BCPClientConfig } from "./lib/types.js"
import { dim, warn } from "./output.js"
import { isStale, readState, writeState, type VboxState } from "./state.js"

export const HEARTBEAT_TTL_MS = 60_000

export interface HeartbeatResult {
  state: VboxState
  refreshed: boolean
}

export async function maintainSession(
  config: BCPClientConfig,
  opts: { ttlMs?: number; now?: number; client?: BCPClient } = {},
): Promise<HeartbeatResult | null> {
  const ttl = opts.ttlMs ?? HEARTBEAT_TTL_MS
  const cached = readState()
  if (!isStale(cached, ttl, opts.now)) {
    return { state: cached as VboxState, refreshed: false }
  }

  const client = opts.client ?? new BCPClient(config)
  let connect: ConnectResponse
  try {
    connect = await client.connect()
  } catch (caught) {
    if (caught instanceof BCPAuthError) {
      process.stderr.write(`${warn("session invalid")} — ${caught.message}. Run \`vbox-cli login\` to re-authenticate.\n`)
      // Drop the cached state so the next run re-probes rather than
      // blindly trusting a snapshot tied to a now-revoked key.
      try { writeState({ version: 1, last_connect_at: new Date(0).toISOString(), connect: cached?.connect ?? ({ status: "disconnected", user_id: "", berry_user_id: "", tier: "", runtime_type: "" } as ConnectResponse) }) } catch { /* best effort */ }
      return null
    }
    if (caught instanceof BCPError) {
      process.stderr.write(`${dim("(heartbeat skipped: HTTP")} ${caught.status ?? "?"} ${caught.message}${dim(")")}\n`)
      return null
    }
    process.stderr.write(`${dim("(heartbeat skipped: network error)")}\n`)
    return null
  }

  const state: VboxState = {
    version: 1,
    last_connect_at: new Date(opts.now ?? Date.now()).toISOString(),
    connect,
  }
  try {
    writeState(state)
  } catch (caught) {
    process.stderr.write(`${dim("(heartbeat: failed to persist state — ")}${caught instanceof Error ? caught.message : String(caught)}${dim(")")}\n`)
  }

  if (cached && cached.connect.tier !== connect.tier) {
    process.stderr.write(`${dim("tier changed:")} ${cached.connect.tier} → ${connect.tier}\n`)
  }

  return { state, refreshed: true }
}
