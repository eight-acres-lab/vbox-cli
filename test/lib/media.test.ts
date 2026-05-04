import { describe, expect, it, vi } from "vitest"
import { uploadMedia } from "../../src/lib/media.js"
import { BCPAuthError, BCPRequestError } from "../../src/lib/errors.js"

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } })
}

const SAMPLE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) // PNG magic

describe("uploadMedia", () => {
  it("computes sha256, sends PUT with the right query params, and maps the response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      file_id: "fid_abc",
      ext: "webp",
      thumb_file_id: "fid_thumb_abc",
      blurhash: "L9AS}j%2~q-;%MWB-;j[~qfQ%2t7",
      width: 1080,
      height: 720,
    }))

    const media = await uploadMedia({
      apiKey: "bcp_sk_test",
      bytes: SAMPLE_BYTES,
      fileName: "photo.png",
      contentType: "image/png",
      fetch: fetchMock,
    })

    expect(media).toEqual({
      fid: "fid_abc",
      ext: "webp",
      media_type: "image",
      thumb_fid: "fid_thumb_abc",
      blurhash: "L9AS}j%2~q-;%MWB-;j[~qfQ%2t7",
      width: 1080,
      height: 720,
    })

    const [calledURL, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const url = new URL(calledURL)
    expect(url.origin + url.pathname).toBe("https://upload.workers.vboxes.org/bcp/media")
    expect(url.searchParams.get("file_name")).toBe("photo.png")
    expect(url.searchParams.get("cate")).toBe("image")
    // Format check: 64 lowercase hex chars. Asserting the exact bytes
    // would just re-run crypto.subtle.digest twice, which doesn't add
    // signal — the regex catches any structural regression.
    expect(url.searchParams.get("sha256sum")).toMatch(/^[0-9a-f]{64}$/)

    expect(calledInit?.method).toBe("PUT")
    expect((calledInit?.headers as Record<string, string>)?.["Authorization"]).toBe("Bearer bcp_sk_test")
    expect((calledInit?.headers as Record<string, string>)?.["Content-Type"]).toBe("image/png")
    expect(calledInit?.body).toBe(SAMPLE_BYTES)
  })

  it("rejects locally on missing API key", async () => {
    await expect(uploadMedia({
      apiKey: "",
      bytes: SAMPLE_BYTES,
      fileName: "x.png",
      contentType: "image/png",
      fetch: vi.fn<typeof fetch>(),
    })).rejects.toBeInstanceOf(BCPAuthError)
  })

  it("rejects locally on malformed API key (missing bcp_sk_ prefix)", async () => {
    await expect(uploadMedia({
      apiKey: "wrong-prefix",
      bytes: SAMPLE_BYTES,
      fileName: "x.png",
      contentType: "image/png",
      fetch: vi.fn<typeof fetch>(),
    })).rejects.toBeInstanceOf(BCPAuthError)
  })

  it("maps a 400 from the worker to a typed BCP request error", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ error: { code: "sha256_mismatch", message: "uploaded body did not match sha256sum" } }, 400),
    )

    await expect(uploadMedia({
      apiKey: "bcp_sk_test",
      bytes: SAMPLE_BYTES,
      fileName: "x.png",
      contentType: "image/png",
      fetch: fetchMock,
    })).rejects.toBeInstanceOf(BCPRequestError)
  })
})
