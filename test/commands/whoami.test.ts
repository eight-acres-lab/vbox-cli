import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { whoami } from "../../src/commands/whoami.js"
import { writeState, type VboxState } from "../../src/state.js"

let xdgDir: string
let originalXDG: string | undefined
let stdoutSpy: ReturnType<typeof vi.spyOn>
let stderrSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  xdgDir = mkdtempSync(join(tmpdir(), "vbox-cli-whoami-"))
  originalXDG = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = xdgDir
  stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
  stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
})

afterEach(() => {
  if (originalXDG === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = originalXDG
  rmSync(xdgDir, { recursive: true, force: true })
  stdoutSpy.mockRestore()
  stderrSpy.mockRestore()
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

describe("whoami command", () => {
  it("prints the cached state as compact JSON", async () => {
    writeState(sample)

    await whoami({})

    const printed = stdoutSpy.mock.calls.flat().join("")
    const parsed = JSON.parse(printed)
    expect(parsed).toEqual({
      berry_user_id: "usr_berry_001",
      user_id: "usr_owner_001",
      tier: "pro",
      runtime_type: "self_hosted",
      last_connect_at: "2026-05-06T10:00:00.000Z",
    })
  })

  it("exits 2 when no cached state exists", async () => {
    let exitCode: number | undefined
    try {
      await whoami({})
    } catch (caught) {
      exitCode = (caught as { exitCode?: number }).exitCode
    }
    expect(exitCode).toBe(2)
  })
})
