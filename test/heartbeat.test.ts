import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BCPClient } from "../src/lib/client.js"
import { BCPAuthError } from "../src/lib/errors.js"
import type { ConnectResponse } from "../src/lib/types.js"
import { maintainSession } from "../src/heartbeat.js"
import { readState, writeState, type VboxState } from "../src/state.js"

let xdgDir: string
let originalXDG: string | undefined
let stderrSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  xdgDir = mkdtempSync(join(tmpdir(), "vbox-cli-heartbeat-"))
  originalXDG = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = xdgDir
  stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
})

afterEach(() => {
  if (originalXDG === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = originalXDG
  rmSync(xdgDir, { recursive: true, force: true })
  stderrSpy.mockRestore()
})

const fakeConnect: ConnectResponse = {
  status: "connected",
  user_id: "usr_owner_001",
  berry_user_id: "usr_berry_001",
  tier: "pro",
  runtime_type: "self_hosted",
}

describe("maintainSession", () => {
  it("hits the network when no cache exists and writes state", async () => {
    let calls = 0
    const fakeFetch = (async () => {
      calls++
      return new Response(JSON.stringify(fakeConnect), { status: 200, headers: { "content-type": "application/json" } })
    }) as typeof fetch
    const client = new BCPClient({ apiKey: "bcp_sk_test", fetch: fakeFetch })

    const now = Date.parse("2026-05-06T10:00:00Z")
    const result = await maintainSession({ apiKey: "bcp_sk_test" }, { client, ttlMs: 60_000, now })

    expect(calls).toBe(1)
    expect(result?.refreshed).toBe(true)
    expect(result?.state.connect).toEqual(fakeConnect)
    expect(readState()?.last_connect_at).toBe(new Date(now).toISOString())
  })

  it("skips the network when cached state is fresh", async () => {
    const now = Date.parse("2026-05-06T10:00:00Z")
    const cached: VboxState = {
      version: 1,
      last_connect_at: new Date(now - 30_000).toISOString(),
      connect: fakeConnect,
    }
    writeState(cached)

    let calls = 0
    const fakeFetch = (async () => {
      calls++
      return new Response("{}", { status: 200 })
    }) as typeof fetch
    const client = new BCPClient({ apiKey: "bcp_sk_test", fetch: fakeFetch })

    const result = await maintainSession({ apiKey: "bcp_sk_test" }, { client, ttlMs: 60_000, now })

    expect(calls).toBe(0)
    expect(result?.refreshed).toBe(false)
  })

  it("re-probes when cached state is past the TTL", async () => {
    const now = Date.parse("2026-05-06T10:00:00Z")
    const cached: VboxState = {
      version: 1,
      last_connect_at: new Date(now - 120_000).toISOString(),
      connect: fakeConnect,
    }
    writeState(cached)

    let calls = 0
    const fakeFetch = (async () => {
      calls++
      return new Response(JSON.stringify({ ...fakeConnect, tier: "max" }), { status: 200, headers: { "content-type": "application/json" } })
    }) as typeof fetch
    const client = new BCPClient({ apiKey: "bcp_sk_test", fetch: fakeFetch })

    const result = await maintainSession({ apiKey: "bcp_sk_test" }, { client, ttlMs: 60_000, now })

    expect(calls).toBe(1)
    expect(result?.refreshed).toBe(true)
    expect(result?.state.connect.tier).toBe("max")
    // tier-changed line was emitted
    const writes = stderrSpy.mock.calls.flat().join("")
    expect(writes).toContain("tier changed")
  })

  it("returns null on auth failure and writes a warning to stderr", async () => {
    const fakeFetch = (async () => {
      return new Response(JSON.stringify({ error: { code: "auth_error", message: "bad key" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }) as typeof fetch
    const client = new BCPClient({ apiKey: "bcp_sk_bad", fetch: fakeFetch })

    const result = await maintainSession({ apiKey: "bcp_sk_bad" }, { client, ttlMs: 60_000 })

    expect(result).toBeNull()
    const writes = stderrSpy.mock.calls.flat().join("")
    expect(writes).toContain("session invalid")
    // After auth failure we void the cache so a fresh connect runs next time.
    const after = readState()
    expect(after?.last_connect_at).toBe(new Date(0).toISOString())
  })

  it("returns null on transient HTTP errors without throwing", async () => {
    const fakeFetch = (async () => {
      return new Response("oops", { status: 500 })
    }) as typeof fetch
    const client = new BCPClient({ apiKey: "bcp_sk_test", fetch: fakeFetch })

    const result = await maintainSession({ apiKey: "bcp_sk_test" }, { client, ttlMs: 60_000 })

    expect(result).toBeNull()
    expect(BCPAuthError.name).toBe("BCPAuthError") // sanity
  })
})
