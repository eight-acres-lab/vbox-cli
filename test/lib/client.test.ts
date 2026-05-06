import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { BCPClient } from "../../src/lib/client.js"

const fixturesRoot = join(import.meta.dirname, "..", "..", "fixtures")

async function fixture<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(join(fixturesRoot, path), "utf8")) as T
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } })
}

describe("BCPClient", () => {
  it("connect sends api_key to /berry/connect without Authorization", async () => {
    const connect = await fixture("responses/connect.json")
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(connect))
    const client = new BCPClient({ apiKey: "bcp_sk_test", baseURL: "https://example.com", fetch: fetchMock })

    const result = await client.connect()

    expect(result).toEqual(connect)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/bcp/v1/berry/connect",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: "bcp_sk_test" }),
      }),
    )
  })

  it("authenticated context methods send Bearer auth and preserve response fields", async () => {
    const me = await fixture("responses/get-me.json")
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(me))
    const client = new BCPClient({ apiKey: "bcp_sk_test", baseURL: "https://example.com", fetch: fetchMock })

    const result = await client.getMe()

    expect(result).toEqual(me)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/bcp/v1/context/me",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer bcp_sk_test" }),
      }),
    )
  })

  it("getPersona, getFeed, and getThread map to documented context routes", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse({ ok: true }))
    const client = new BCPClient({ apiKey: "bcp_sk_test", baseURL: "https://example.com", fetch: fetchMock })

    await client.getPersona()
    await client.getFeed({ page: 2, pageSize: 20 })
    await client.getThread("ct_001")

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://example.com/bcp/v1/context/persona", expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://example.com/bcp/v1/context/feed?page=2&page_size=20", expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://example.com/bcp/v1/context/thread?content_id=ct_001", expect.any(Object))
  })

  it("pollEvents maps camelCase options to snake_case query params and parses fixtures", async () => {
    const sample = await fixture("events/impression.json")
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ events: [sample], has_more: false, next_cursor: "next" }))
    const client = new BCPClient({ apiKey: "bcp_sk_test", baseURL: "https://example.com", fetch: fetchMock })

    const result = await client.pollEvents({ afterId: "evt_000", limit: 5 })

    expect(result.events[0]).toEqual(sample)
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/bcp/v1/berry/events?after_id=evt_000&limit=5", expect.any(Object))
  })

  it("ackEvent posts status and reason to the event ack path", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: true }))
    const client = new BCPClient({ apiKey: "bcp_sk_test", baseURL: "https://example.com", fetch: fetchMock })

    await client.ackEvent("evt_001", { status: "completed", reason: "done" })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/bcp/v1/events/evt_001/ack",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ status: "completed", reason: "done" }),
      }),
    )
  })

  it("maps public camelCase action inputs to snake_case wire payloads", async () => {
    const action = await fixture("responses/action-reply.json")
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse(action))
    const client = new BCPClient({ apiKey: "bcp_sk_test", baseURL: "https://example.com", fetch: fetchMock })

    await client.reply({ contentId: "ct_001", textContent: "hello", parentId: "cmt_001", language: "en" })
    await client.deleteContent({ contentId: "ct_001" })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.com/bcp/v1/actions/reply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content_id: "ct_001", text_content: "hello", parent_id: "cmt_001", language: "en" }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.com/bcp/v1/actions/delete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content_id: "ct_001" }),
      }),
    )
  })
})
