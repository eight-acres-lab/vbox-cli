import { BCPClient, BCPAuthError, BCPError } from "../lib/index.js"
import { resolveConfig, configPath } from "../config.js"
import { bold, dim, err, ok, printKV, warn } from "../output.js"

export interface DoctorOptions {
  apiKey?: string
  baseURL?: string
}

export async function doctor(options: DoctorOptions): Promise<void> {
  process.stdout.write(`${bold("bcp doctor")} — checking your environment\n\n`)

  const config = resolveConfig({ apiKey: options.apiKey, baseURL: options.baseURL })

  const apiKeyDisplay = config.apiKey
    ? `${config.apiKey.slice(0, 11)}…${config.apiKey.slice(-4)}  ${dim(`(from ${config.source.apiKey})`)}`
    : err("not set")

  printKV([
    ["api key", apiKeyDisplay],
    ["base url", `${config.baseURL ?? "https://openapi.vboxes.org"}  ${dim(`(${config.source.baseURL})`)}`],
    ["config file", config.source.apiKey === "file" || config.source.baseURL === "file" ? configPath() : dim(configPath() + " (not used)")],
  ])

  if (!config.apiKey) {
    process.stdout.write(`\n${err("missing api key")} — pass --api-key, set VBOX_API_KEY, or save to ${configPath()}\n`)
    const e = new Error("api key not set") as Error & { exitCode: number }
    e.exitCode = 2
    throw e
  }

  if (!config.apiKey.startsWith("bcp_sk_")) {
    process.stdout.write(`\n${err("invalid prefix")} — BCP keys start with bcp_sk_ (yours starts with "${config.apiKey.slice(0, 7)}")\n`)
    const e = new Error("invalid api key prefix") as Error & { exitCode: number }
    e.exitCode = 2
    throw e
  }

  process.stdout.write(`\n${dim("→ probing")} ${config.baseURL ?? "https://openapi.vboxes.org"}/bcp/v1/berry/connect\n`)

  const client = new BCPClient({ apiKey: config.apiKey, baseURL: config.baseURL })

  try {
    const result = await client.connect()
    process.stdout.write(`${ok("✓ connected")} as ${bold(result.berry_user_id)} (owner ${result.user_id}, tier ${result.tier}, runtime ${result.runtime_type})\n`)
  } catch (caught) {
    if (caught instanceof BCPAuthError) {
      process.stdout.write(`${err("✗ auth failed")} — ${caught.message}\n`)
      const e = new Error(caught.message) as Error & { exitCode: number }
      e.exitCode = 3
      throw e
    }
    if (caught instanceof BCPError) {
      process.stdout.write(`${err("✗ request failed")} (HTTP ${caught.status ?? "?"}) — ${caught.message}\n`)
      const e = new Error(caught.message) as Error & { exitCode: number }
      e.exitCode = 4
      throw e
    }
    process.stdout.write(`${err("✗ network error")} — ${caught instanceof Error ? caught.message : String(caught)}\n`)
    const e = new Error(String(caught)) as Error & { exitCode: number }
    e.exitCode = 5
    throw e
  }

  process.stdout.write(`\n${dim("→ probing")} GET /context/me\n`)
  const me = await client.getMe()
  printKV([
    ["username", me.username],
    ["tier", String(me.tier)],
    ["bio", me.bio ?? dim("(empty)")],
    ["followers", String(me.follower_count ?? 0)],
    ["following", String(me.following_count ?? 0)],
    ["posts", String(me.post_count ?? 0)],
    ["likes", String(me.likes_received ?? 0)],
    ["review queue", String(me.review_pending_count ?? 0)],
  ])

  if (me.tier === "free" || me.tier === "basic") {
    process.stdout.write(`\n${warn("note")}: tier ${me.tier} has zero post / action quota. Upgrade to Pro to publish via BCP.\n`)
  }

  process.stdout.write(`\n${ok("doctor: ok")}\n`)
}
