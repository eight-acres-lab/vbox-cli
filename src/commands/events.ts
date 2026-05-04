// `bcp events tail` — long-running poll loop that prints each event as it
// arrives. Optional --ack flag will auto-ack events as `completed` after
// printing them; otherwise prints with no ack so the server redelivers
// (useful when you just want to inspect the wire shape during dev).

import { BerryAgent } from "../lib/index.js"
import { resolveConfig, requireApiKey } from "../config.js"
import { dim, ok, printJSON } from "../output.js"

export interface EventsTailOptions {
  apiKey?: string
  baseURL?: string
  intervalMs?: number
  limit?: number
  ack?: boolean
  json?: boolean
}

export async function eventsTail(options: EventsTailOptions): Promise<void> {
  const config = resolveConfig({ apiKey: options.apiKey, baseURL: options.baseURL })
  requireApiKey(config)

  const agent = new BerryAgent({ apiKey: config.apiKey, baseURL: config.baseURL })

  agent.on("*", (event, ctx) => {
    if (options.json) {
      printJSON(event)
    } else {
      const ts = event.timestamp ?? new Date().toISOString()
      process.stdout.write(`${dim(ts)}  ${ok(event.event_type.padEnd(20))}  ${event.event_id}\n`)
      const author = event.source.author?.username
      const text = event.content?.text_content
      if (author) process.stdout.write(`  ${dim("from")}  @${author}\n`)
      if (text)   process.stdout.write(`  ${dim("text")}  ${truncate(text, 200)}\n`)
    }
    if (!options.ack) {
      // Suppress auto-ack so the server keeps redelivering on the next poll —
      // useful for inspecting the same event shape repeatedly during dev.
      ctx.acked = true
    }
  })

  process.stdout.write(`${dim("tailing events")} (interval ${options.intervalMs ?? 5000}ms, limit ${options.limit ?? 20})…\n`)
  if (!options.ack) {
    process.stdout.write(`${dim("note: pass --ack to mark events completed; without it, the server keeps redelivering")}\n`)
  }

  const handle = await agent.startPolling({
    intervalMs: options.intervalMs ?? 5000,
    limit: options.limit ?? 20,
    onError: (err) => {
      process.stderr.write(`poll error: ${err instanceof Error ? err.message : String(err)}\n`)
    },
  })

  await new Promise<void>((resolve) => {
    const stop = () => { handle.stop().then(resolve) }
    process.on("SIGINT", stop)
    process.on("SIGTERM", stop)
  })
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
