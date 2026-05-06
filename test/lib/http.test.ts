import { describe, expect, it, vi } from "vitest"
import { BCPAuthError, BCPRateLimitError, BCPRequestError, BCPServerError } from "../../src/lib/errors.js"
import { requestJSON } from "../../src/lib/http.js"

describe("requestJSON", () => {
  it("uses the default BCP origin, appends /bcp/v1 internally, and parses JSON", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, extra: "kept" }), { status: 200 }),
    )

    const response = await requestJSON({ apiKey: "bcp_sk_test", fetch: fetchMock }, "GET", "/context/me")

    expect(response).toEqual({ ok: true, extra: "kept" })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openapi.vboxes.org/bcp/v1/context/me",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer bcp_sk_test" }),
      }),
    )
  })

  it("uses an injected fetch and custom baseURL origin", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await requestJSON({ apiKey: "bcp_sk_test", baseURL: "https://example.com/", fetch: fetchMock }, "POST", "/actions/reply", {
      text_content: "hello",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/bcp/v1/actions/reply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text_content: "hello" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer bcp_sk_test",
        }),
      }),
    )
  })

  it("omits Authorization when auth is false for connect", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ status: "connected" }), { status: 200 }))

    await requestJSON({ apiKey: "bcp_sk_test", baseURL: "https://example.com", fetch: fetchMock }, "POST", "/berry/connect", {
      api_key: "bcp_sk_test",
    }, { auth: false })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/bcp/v1/berry/connect",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      }),
    )
  })

  it("rejects missing and malformed API keys locally as auth errors without status", async () => {
    const fetchMock = vi.fn<typeof fetch>()

    await expect(requestJSON({ apiKey: "", fetch: fetchMock }, "GET", "/context/me")).rejects.toMatchObject({
      name: "BCPAuthError",
      status: undefined,
    })
    await expect(requestJSON({ apiKey: "bad", fetch: fetchMock }, "GET", "/context/me")).rejects.toBeInstanceOf(BCPAuthError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("maps structured rate limit responses and retry_after dates", async () => {
    const response = {
      error: {
        code: "rate_limited",
        message: "Too many reply actions this hour.",
        retry_after: "2026-04-27T11:00:00Z",
      },
    }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(response), { status: 429 }))

    await expect(requestJSON({ apiKey: "bcp_sk_test", fetch: fetchMock }, "POST", "/actions/reply", {})).rejects.toMatchObject({
      name: "BCPRateLimitError",
      status: 429,
      code: "rate_limited",
      response,
      retryAfter: new Date("2026-04-27T11:00:00Z"),
    })
  })

  it("maps auth, request, and server HTTP errors", async () => {
    const authFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: "bad key" }), { status: 401 }))
    await expect(requestJSON({ apiKey: "bcp_sk_test", fetch: authFetch }, "GET", "/context/me")).rejects.toBeInstanceOf(BCPAuthError)

    const requestFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Invalid" } }), { status: 422 }))
    await expect(requestJSON({ apiKey: "bcp_sk_test", fetch: requestFetch }, "GET", "/context/me")).rejects.toBeInstanceOf(BCPRequestError)

    const serverFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: "oops" }), { status: 500 }))
    await expect(requestJSON({ apiKey: "bcp_sk_test", fetch: serverFetch }, "GET", "/context/me")).rejects.toBeInstanceOf(BCPServerError)
  })
})
