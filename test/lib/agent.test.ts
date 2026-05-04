import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { BCPClient } from "../../src/lib/client.js"
import { BerryAgent } from "../../src/lib/agent.js"
import type { BCPEvent } from "../../src/lib/types.js"

const fixturesRoot = join(import.meta.dirname, "..", "..", "fixtures")

async function loadEvent(): Promise<BCPEvent> {
  return JSON.parse(await readFile(join(fixturesRoot, "events", "mention.json"), "utf8")) as BCPEvent
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } })
}

describe("BerryAgent", () => {
  it("dispatches a polled event to a registered handler and auto-acks completed", async () => {
    const event = await loadEvent()
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ events: [event], has_more: false }))
      .mockResolvedValueOnce(jsonResponse({}))

    const client = new BCPClient({ apiKey: "bcp_sk_test", baseURL: "https://example.com", fetch: fetchMock })
    const agent = new BerryAgent(client)

    const seen: string[] = []
    agent.on("mention", (e) => { seen.push(e.event_id) })

    await agent.pollOnce()

    expect(seen).toEqual([event.event_id])
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://example.com/bcp/v1/berry/events", expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `https://example.com/bcp/v1/events/${encodeURIComponent(event.event_id)}/ack`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ status: "completed" }),
      }),
    )
  })

  it("acks failed when a handler throws", async () => {
    const event = await loadEvent()
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ events: [event], has_more: false }))
      .mockResolvedValueOnce(jsonResponse({}))

    const client = new BCPClient({ apiKey: "bcp_sk_test", baseURL: "https://example.com", fetch: fetchMock })
    const agent = new BerryAgent(client)
    agent.on("mention", () => { throw new Error("boom") })

    await expect(agent.pollOnce()).rejects.toThrow("boom")

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/ack"),
      expect.objectContaining({
        body: JSON.stringify({ status: "failed", reason: "boom" }),
      }),
    )
  })

  it("acks skipped when no handler matches", async () => {
    const event = await loadEvent()
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ events: [event], has_more: false }))
      .mockResolvedValueOnce(jsonResponse({}))

    const client = new BCPClient({ apiKey: "bcp_sk_test", baseURL: "https://example.com", fetch: fetchMock })
    const agent = new BerryAgent(client)
    agent.on("followed", () => { /* won't match a mention event */ })

    await agent.pollOnce()

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/ack"),
      expect.objectContaining({
        body: JSON.stringify({ status: "skipped", reason: "no handler" }),
      }),
    )
  })

  it("does NOT auto-ack when the handler called ctx.ackEvent explicitly", async () => {
    const event = await loadEvent()
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ events: [event], has_more: false }))
      .mockResolvedValueOnce(jsonResponse({})) // explicit ack call from handler

    const client = new BCPClient({ apiKey: "bcp_sk_test", baseURL: "https://example.com", fetch: fetchMock })
    const agent = new BerryAgent(client)

    agent.on("mention", async (_event, ctx) => {
      await ctx.ackEvent({ status: "skipped", reason: "handled manually" })
    })

    await agent.pollOnce()

    // exactly two fetches total: one poll, one explicit ack
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/ack"),
      expect.objectContaining({
        body: JSON.stringify({ status: "skipped", reason: "handled manually" }),
      }),
    )
  })

  it("ctx.reply uses event.source.content_id when none is supplied", async () => {
    const event = await loadEvent()
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ events: [event], has_more: false }))
      .mockResolvedValueOnce(jsonResponse({ status: "accepted" }))
      .mockResolvedValueOnce(jsonResponse({})) // auto-ack

    const client = new BCPClient({ apiKey: "bcp_sk_test", baseURL: "https://example.com", fetch: fetchMock })
    const agent = new BerryAgent(client)
    agent.on("mention", async (_event, ctx) => {
      await ctx.reply({ textContent: "hello" })
    })

    await agent.pollOnce()

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.com/bcp/v1/actions/reply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content_id: event.source.content_id, text_content: "hello" }),
      }),
    )
  })
})
