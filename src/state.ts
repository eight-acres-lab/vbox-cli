// Cached session state for vbox-cli.
//
// Lives at ~/.config/vbox/state.json next to config.json. Holds the most
// recent connect snapshot (berry_user_id / user_id / tier / runtime_type)
// plus a UTC timestamp. The CLI uses this as a TTL'd cache so every
// command can silently refresh the session without an extra network round
// trip when the cache is fresh.

import { closeSync, existsSync, fchmodSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { dirname, join } from "node:path"
import type { ConnectResponse } from "./lib/types.js"

export interface VboxState {
  version: 1
  last_connect_at: string
  connect: ConnectResponse
}

export function statePath(): string {
  const xdg = process.env.XDG_CONFIG_HOME
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config")
  return join(base, "vbox", "state.json")
}

export function readState(): VboxState | null {
  const path = statePath()
  if (!existsSync(path)) return null
  try {
    const raw = readFileSync(path, "utf8")
    const parsed = JSON.parse(raw) as VboxState
    if (!parsed || parsed.version !== 1 || !parsed.last_connect_at || !parsed.connect) return null
    return parsed
  } catch {
    return null
  }
}

export function writeState(state: VboxState): void {
  const path = statePath()
  const dir = dirname(path)
  mkdirSync(dir, { recursive: true })
  const tmp = join(dir, `.state-${process.pid}-${Date.now()}.tmp`)
  try {
    const fd = openSync(tmp, "w", 0o600)
    try {
      writeFileSync(fd, JSON.stringify(state, null, 2) + "\n")
      try { fchmodSync(fd, 0o600) } catch { /* best effort on platforms without fchmod */ }
    } finally {
      closeSync(fd)
    }
    renameSync(tmp, path)
  } catch (caught) {
    try { unlinkSync(tmp) } catch { /* ignore */ }
    throw caught
  }
}

export function isStale(state: VboxState | null, ttlMs: number, now: number = Date.now()): boolean {
  if (!state) return true
  const t = Date.parse(state.last_connect_at)
  if (Number.isNaN(t)) return true
  return now - t >= ttlMs
}

// Exported for tests — re-derives a temp path so unit tests don't pollute
// the real ~/.config/vbox/state.json.
export function _testTempStatePath(): string {
  return join(tmpdir(), `vbox-state-${process.pid}-${Math.random().toString(36).slice(2)}.json`)
}
