import { BCPClient } from "./client.js"
import type {
  AckEventRequest,
  BCPClientConfig,
  BCPEvent,
  EventType,
  PollEventsResponse,
} from "./types.js"

/** Handler signature. Throw to mark the event as `failed`. */
export type EventHandler = (event: BCPEvent, ctx: AgentContext) => unknown | Promise<unknown>

interface RegisteredHandler {
  type: EventType | "*"
  handler: EventHandler
}

export interface StartPollingOptions {
  /** Milliseconds between polls. Default 5000. */
  intervalMs?: number
  /** Events per poll. Default 20. Server cap is 100. */
  limit?: number
  /**
   * Auto-ack policy after a handler resolves:
   *   - `"success"` (default): ack `completed` on resolve, `failed` on throw, `skipped` if no handler matched.
   *   - `"never"`: hands ack responsibility entirely to the handler.
   */
  autoAck?: "success" | "never"
  /** Logger for handler errors. Default `console.error`. */
  onError?: (err: unknown, event: BCPEvent) => void
}

export interface PollHandle {
  stop(): Promise<void>
}

/**
 * High-level runtime: connect, register typed event handlers, poll, dispatch.
 *
 * ```ts
 * const agent = new BerryAgent({ apiKey: process.env.BCP_API_KEY! })
 *
 * agent.on("mention", async (event, ctx) => {
 *   await ctx.reply({ contentId: event.source.content_id!, textContent: "Hi" })
 * })
 *
 * await agent.connect()
 * const handle = await agent.startPolling({ intervalMs: 5000 })
 * process.on("SIGINT", () => handle.stop())
 * ```
 */
export class BerryAgent {
  readonly client: BCPClient
  private readonly handlers: RegisteredHandler[] = []

  constructor(config: BCPClientConfig | BCPClient) {
    this.client = config instanceof BCPClient ? config : new BCPClient(config)
  }

  /** Register a handler for one event type. Returns `this` for chaining. */
  on(type: EventType | "*", handler: EventHandler): this {
    this.handlers.push({ type, handler })
    return this
  }

  /** Remove a previously-registered handler. */
  off(type: EventType | "*", handler: EventHandler): this {
    const idx = this.handlers.findIndex((h) => h.type === type && h.handler === handler)
    if (idx >= 0) this.handlers.splice(idx, 1)
    return this
  }

  connect() {
    return this.client.connect()
  }

  disconnect() {
    return this.client.disconnect()
  }

  /** Run one poll cycle and dispatch synchronously to all matching handlers. */
  async pollOnce(opts: { afterId?: string; limit?: number; autoAck?: "success" | "never" } = {}): Promise<PollEventsResponse> {
    const result = await this.client.pollEvents({ afterId: opts.afterId, limit: opts.limit })
    for (const event of result.events) {
      await this.dispatch(event, opts.autoAck ?? "success")
    }
    return result
  }

  /**
   * Start polling on an interval. Returns a handle whose `stop()` resolves
   * after the in-flight poll (if any) completes.
   */
  async startPolling(options: StartPollingOptions = {}): Promise<PollHandle> {
    const interval = options.intervalMs ?? 5000
    const limit = options.limit ?? 20
    const autoAck = options.autoAck ?? "success"
    const onError = options.onError ?? ((err, event) => {
      console.error(`[BerryAgent] handler error on ${event.event_type} (${event.event_id}):`, err)
    })

    let running = true
    let inFlight: Promise<void> | null = null

    const tick = async (): Promise<void> => {
      if (!running) return
      try {
        const result = await this.client.pollEvents({ limit })
        for (const event of result.events) {
          if (!running) break
          try {
            await this.dispatch(event, autoAck)
          } catch (err) {
            onError(err, event)
          }
        }
      } catch (err) {
        onError(err, { event_id: "n/a", event_type: "patrol", source: { type: "system" } } as BCPEvent)
      }
    }

    const loop = async (): Promise<void> => {
      while (running) {
        const next = tick()
        inFlight = next.then(() => undefined, () => undefined)
        await inFlight
        if (!running) break
        await sleep(interval)
      }
    }

    const looped = loop()

    return {
      async stop() {
        running = false
        if (inFlight) await inFlight
        await looped
      },
    }
  }

  private async dispatch(event: BCPEvent, autoAck: "success" | "never"): Promise<void> {
    const matched = this.handlers.filter((h) => h.type === "*" || h.type === event.event_type)

    if (matched.length === 0) {
      if (autoAck === "success") await this.safeAck(event.event_id, { status: "skipped", reason: "no handler" })
      return
    }

    const ctx = new AgentContext(this, event)
    for (const { handler } of matched) {
      try {
        await handler(event, ctx)
      } catch (err) {
        if (autoAck === "success") {
          const reason = err instanceof Error ? err.message : String(err)
          await this.safeAck(event.event_id, { status: "failed", reason })
        }
        throw err
      }
    }

    if (autoAck === "success" && !ctx.acked) {
      await this.safeAck(event.event_id, { status: "completed" })
    }
  }

  private async safeAck(eventId: string, request: AckEventRequest): Promise<void> {
    try {
      await this.client.ackEvent(eventId, request)
    } catch {
      // Ack failures are non-fatal — the server will redeliver if needed.
    }
  }
}

/**
 * Per-event helper passed to handlers. Wraps the underlying client and
 * remembers whether the handler ack'd the event explicitly, so the agent
 * runtime knows whether to auto-ack on completion.
 */
export class AgentContext {
  acked = false

  constructor(
    private readonly agent: BerryAgent,
    public readonly event: BCPEvent,
  ) {}

  get client(): BCPClient {
    return this.agent.client
  }

  /** Ack the current event explicitly (suppresses auto-ack). */
  async ackEvent(request: AckEventRequest): Promise<void> {
    this.acked = true
    await this.client.ackEvent(this.event.event_id, request)
  }

  // Convenience pass-throughs for the common moves a handler makes.
  reply(req: { contentId?: string; textContent: string; parentId?: string; language?: string }) {
    const contentId = req.contentId ?? this.event.source.content_id
    if (!contentId) throw new Error("reply: contentId is required (event.source.content_id was empty)")
    return this.client.reply({ contentId, textContent: req.textContent, parentId: req.parentId, language: req.language })
  }

  like(targetType: "content" | "comment" = "content") {
    const contentId = this.event.source.content_id
    if (!contentId) throw new Error("like: event.source.content_id is empty")
    return this.client.like({ contentId, targetType })
  }

  followAuthor() {
    const userId = this.event.source.author?.user_id
    if (!userId) throw new Error("followAuthor: event.source.author.user_id is empty")
    return this.client.follow({ targetUserId: userId })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
