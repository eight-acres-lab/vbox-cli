import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { post } from "../../src/commands/post.js"

// Verifies the CLI-level post() command builds the right wire payload
// (text-only, image with one fid, image with multiple fids, mediaType
// override) by intercepting fetch.

interface CapturedRequest {
  url: string
  method: string
  body: Record<string, unknown>
}

function installFetchMock(response: Record<string, unknown>) {
  const captured: CapturedRequest[] = []
  const fakeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString()
    const body = init?.body ? JSON.parse(init.body as string) : {}
    captured.push({ url, method: init?.method ?? "GET", body })
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  })
  vi.stubGlobal("fetch", fakeFetch)
  return { captured, fakeFetch }
}

const stdoutMock = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

beforeEach(() => {
  // Note: the BCP HTTP layer locally validates the key starts with bcp_sk_
  // (the server-side key prefix). The vbox-cli rebrand changed the env var
  // name (VBOX_API_KEY) and config path (~/.config/vbox/) but the actual
  // key format is still server-issued bcp_sk_*.
  process.env.VBOX_API_KEY = "bcp_sk_test"
  process.env.VBOX_BASE_URL = "https://stub-api.test"
  stdoutMock.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.VBOX_API_KEY
  delete process.env.VBOX_BASE_URL
})

describe("post command", () => {
  it("text-only: mediaType resolves to 'text', no media_list in payload", async () => {
    const { captured } = installFetchMock({
      success: true,
      resource_id: "post_test",
      status: "published",
    })

    await post({ text: "good morning" })

    expect(captured).toHaveLength(1)
    expect(captured[0]!.method).toBe("POST")
    expect(captured[0]!.url).toContain("/actions/post")
    expect(captured[0]!.body).toMatchObject({
      text_content: "good morning",
      media_type: "text",
    })
    expect(captured[0]!.body).not.toHaveProperty("media_list")
  })

  it("--media-fid given: mediaType auto-flips to 'image' and media_list is built with png defaults", async () => {
    const { captured } = installFetchMock({
      success: true,
      resource_id: "post_review",
      status: "pending_review",
    })

    await post({
      text: "lunch at the noodle shop",
      mediaFid: ["fid_abc123"],
    })

    expect(captured[0]!.body).toMatchObject({
      text_content: "lunch at the noodle shop",
      media_type: "image",
      media_list: [{ fid: "fid_abc123", ext: "png", media_type: "image" }],
    })
  })

  it("multiple --media-fid values are all attached", async () => {
    const { captured } = installFetchMock({
      success: true,
      resource_id: "post_multi",
      status: "published",
    })

    await post({
      text: "carousel",
      mediaFid: ["fid_a", "fid_b", "fid_c"],
    })

    const payload = captured[0]!.body as { media_list?: { fid: string }[] }
    expect(payload.media_list).toHaveLength(3)
    expect(payload.media_list?.map((m) => m.fid)).toEqual(["fid_a", "fid_b", "fid_c"])
  })

  it("--media-ext overrides the default extension", async () => {
    const { captured } = installFetchMock({
      success: true,
      resource_id: "post_jpeg",
      status: "published",
    })

    await post({
      text: "phone snapshot",
      mediaFid: ["fid_x"],
      mediaExt: "jpg",
    })

    const payload = captured[0]!.body as { media_list?: { ext: string }[] }
    expect(payload.media_list?.[0]!.ext).toBe("jpg")
  })

  it("--media-type explicitly forces the post type (overrides auto-detect)", async () => {
    const { captured } = installFetchMock({
      success: true,
      resource_id: "post_video",
      status: "published",
    })

    await post({
      text: "watch this",
      mediaFid: ["fid_v"],
      mediaType: "video",
    })

    expect(captured[0]!.body).toMatchObject({ media_type: "video" })
  })
})
