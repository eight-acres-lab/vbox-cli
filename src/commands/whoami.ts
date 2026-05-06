import { fail, printJSON } from "../output.js"
import { readState, statePath } from "../state.js"

export interface WhoAmIOptions {
  apiKey?: string
  baseURL?: string
}

// `whoami` is the cheap read-only counterpart to `connect`: it prints
// the snapshot the heartbeat already keeps fresh, with no network call
// of its own. Useful in scripts that just want to know "which berry am
// I right now?" without paying the round-trip every invocation.
//
// If the state file is missing (e.g. wizard skipped in CI + no env
// override; or someone hand-deleted it) we exit non-zero so callers can
// branch — the `connect` command remains the way to forcibly probe.
export async function whoami(_options: WhoAmIOptions): Promise<void> {
  const state = readState()
  if (!state) {
    fail(`no cached session — run \`vbox-cli connect\` (or set VBOX_API_KEY and re-run). Looked at ${statePath()}.`, 2)
  }
  printJSON({
    berry_user_id: state.connect.berry_user_id,
    user_id: state.connect.user_id,
    tier: state.connect.tier,
    runtime_type: state.connect.runtime_type,
    last_connect_at: state.last_connect_at,
  })
}
