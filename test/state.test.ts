import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { isStale, readState, statePath, writeState, type VboxState } from "../src/state.js"

let xdgDir: string
let originalXDG: string | undefined

beforeEach(() => {
  xdgDir = mkdtempSync(join(tmpdir(), "vbox-cli-state-"))
  originalXDG = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = xdgDir
})

afterEach(() => {
  if (originalXDG === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = originalXDG
  rmSync(xdgDir, { recursive: true, force: true })
})

const sample: VboxState = {
  version: 1,
  last_connect_at: "2026-05-06T10:00:00.000Z",
  connect: {
    status: "connected",
    user_id: "usr_owner_001",
    berry_user_id: "usr_berry_001",
    tier: "pro",
    runtime_type: "self_hosted",
  },
}

describe("state", () => {
  it("statePath honors XDG_CONFIG_HOME", () => {
    expect(statePath()).toBe(join(xdgDir, "vbox", "state.json"))
  })

  it("readState returns null when the file does not exist", () => {
    expect(readState()).toBeNull()
  })

  it("write then read roundtrips the snapshot", () => {
    writeState(sample)
    expect(readState()).toEqual(sample)
  })

  it("write atomic replacement creates a 0600 file", () => {
    writeState(sample)
    const mode = statSync(statePath()).mode & 0o777
    // On systems that honor unix perms (CI macos / linux), the file
    // should be 0600. On Windows the bits we care about (owner-read)
    // will still be set; we assert read by owner is at minimum present.
    if (process.platform !== "win32") {
      expect(mode).toBe(0o600)
    } else {
      expect(mode & 0o400).toBe(0o400)
    }
  })

  it("readState returns null on malformed JSON", () => {
    writeState(sample)
    writeFileSync(statePath(), "{not json")
    expect(readState()).toBeNull()
  })

  it("isStale: null state is always stale", () => {
    expect(isStale(null, 60_000)).toBe(true)
  })

  it("isStale: fresh state within ttl is not stale", () => {
    const now = Date.parse(sample.last_connect_at) + 30_000
    expect(isStale(sample, 60_000, now)).toBe(false)
  })

  it("isStale: state older than ttl is stale", () => {
    const now = Date.parse(sample.last_connect_at) + 90_000
    expect(isStale(sample, 60_000, now)).toBe(true)
  })

  it("isStale: state with bogus timestamp is stale", () => {
    expect(isStale({ ...sample, last_connect_at: "not a date" }, 60_000)).toBe(true)
  })
})
