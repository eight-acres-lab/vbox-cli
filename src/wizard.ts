// First-run setup wizard.
//
// Triggered automatically by the preAction hook when no API key is
// resolvable AND both stdin/stdout are TTYs. Also reachable explicitly
// via `vbox-cli login`. Flow:
//
//   1. Prompt for the BCP key (echoed as bullets).
//   2. Local-validate the bcp_sk_ prefix; reprompt on mismatch.
//   3. POST /berry/connect with the candidate key. On 401/403 reprompt;
//      on other errors abort with a readable message.
//   4. On success: write key to ~/.config/vbox/config.json (0600) and
//      seed ~/.config/vbox/state.json so the next command's heartbeat
//      sees a fresh cache.

import { writeConfigFile, configPath } from "./config.js"
import { BCPClient, BCPAuthError, BCPError } from "./lib/index.js"
import type { ConnectResponse } from "./lib/types.js"
import { bold, dim, ok, warn } from "./output.js"
import { writeState } from "./state.js"

const BANNER = `\nvbox-cli — first-run setup\n`

export interface WizardResult {
  apiKey: string
  connect: ConnectResponse
}

// runWizard prompts interactively, validates against the live BCP API,
// and persists on success. Returns null when the user cancels (Ctrl-C
// or empty input on the cancel prompt).
export async function runWizard(opts: { baseURL?: string } = {}): Promise<WizardResult | null> {
  process.stderr.write(bold(BANNER) + "\n")
  process.stderr.write(
    `Paste your V-Box BCP API key. It starts with ${bold("bcp_sk_")} and is\n` +
    `issued from the V-Box app under Settings → BCP. The key will be saved to\n` +
    `${configPath()} (mode 0600).\n\n`,
  )

  while (true) {
    const apiKey = await promptMasked(`${dim("api key:")} `)
    if (!apiKey) {
      process.stderr.write(`\n${warn("cancelled")} — no key entered.\n`)
      return null
    }
    if (!apiKey.startsWith("bcp_sk_")) {
      process.stderr.write(`${warn("invalid prefix")} — keys start with bcp_sk_ (got "${apiKey.slice(0, 7)}…"). Try again.\n\n`)
      continue
    }

    process.stderr.write(`${dim("→ probing")} ${opts.baseURL ?? "https://openapi.vboxes.org"}/bcp/v1/berry/connect …\n`)
    const client = new BCPClient({ apiKey, baseURL: opts.baseURL })
    let connect: ConnectResponse
    try {
      connect = await client.connect()
    } catch (caught) {
      if (caught instanceof BCPAuthError) {
        process.stderr.write(`${warn("auth failed")} — ${caught.message}. Try a different key.\n\n`)
        continue
      }
      if (caught instanceof BCPError) {
        process.stderr.write(`\nrequest failed (HTTP ${caught.status ?? "?"}) — ${caught.message}\n`)
        return null
      }
      process.stderr.write(`\nnetwork error — ${caught instanceof Error ? caught.message : String(caught)}\n`)
      return null
    }

    writeConfigFile({ apiKey, baseURL: opts.baseURL })
    writeState({
      version: 1,
      last_connect_at: new Date().toISOString(),
      connect,
    })

    process.stderr.write(
      `\n${ok("✓ connected")} as ${bold(connect.berry_user_id)} ` +
      `(owner ${connect.user_id}, tier ${connect.tier}, runtime ${connect.runtime_type})\n` +
      `${dim("saved to")} ${configPath()}\n\n`,
    )
    return { apiKey, connect }
  }
}

// Control byte codes for raw-mode stdin handling.
const CTRL_C = 0x03
const CTRL_D = 0x04
const BACKSPACE = 0x08
const DEL = 0x7f

// promptMasked reads a line from stdin without echoing the typed
// characters back to the terminal. Each printable byte produces a single
// '•' on stderr; backspace deletes one bullet. Returns "" when the user
// hits Ctrl-C or sends EOF before any input.
function promptMasked(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin
    process.stderr.write(prompt)

    const wasRaw = stdin.isRaw
    stdin.setRawMode?.(true)
    stdin.resume()
    stdin.setEncoding("utf8")

    let buffer = ""
    let done = false

    const finish = (value: string) => {
      if (done) return
      done = true
      stdin.removeListener("data", onData)
      stdin.setRawMode?.(wasRaw ?? false)
      stdin.pause()
      process.stderr.write("\n")
      resolve(value)
    }

    const onData = (chunk: string) => {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0)
        if (ch === "\r" || ch === "\n") return finish(buffer.trim())
        if (code === CTRL_C) return finish("")
        if (code === CTRL_D) return finish(buffer.trim())
        if (code === DEL || code === BACKSPACE) {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1)
            process.stderr.write("\b \b")
          }
          continue
        }
        if (code < 0x20) continue // ignore other control bytes (arrow keys, etc)
        buffer += ch
        process.stderr.write("•")
      }
    }

    stdin.on("data", onData)
  })
}
