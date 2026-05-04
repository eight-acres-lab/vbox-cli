import { localAuthError, mapBCPError } from "./errors.js"
import type { MediaItem } from "./types.js"

const DEFAULT_UPLOAD_URL = "https://upload.workers.vboxes.org/bcp/media"

export interface UploadOptions {
  apiKey: string
  /** Raw bytes. */
  bytes: Uint8Array
  /** Original file name; used by the worker for content-disposition + extension hint. */
  fileName: string
  /** MIME type, e.g. `image/jpeg`, `image/webp`. */
  contentType: string
  /** `image` | `avatar` | `video` | `audio`. The worker re-encodes images & avatars to WebP. */
  category?: "image" | "avatar" | "video" | "audio"
  /** Override the upload endpoint. Defaults to `https://upload.workers.vboxes.org/bcp/media`. */
  uploadURL?: string
  /** Inject a custom fetch (for tests or non-Node environments). */
  fetch?: typeof fetch
}

export interface UploadWorkerResponse {
  file_id: string
  ext: string
  thumb_file_id?: string
  blurhash?: string
  width?: number
  height?: number
}

/**
 * Upload bytes to the BCP media worker and return a {@link MediaItem} ready
 * to be passed to {@link BCPClient.post} as part of `mediaList`.
 *
 * The worker computes its own SHA-256 over the streamed body and rejects on
 * mismatch with the `sha256sum` query parameter, so we compute and forward
 * the hash here. Auth is forwarded to BCP for the daily quota check.
 */
export async function uploadMedia(options: UploadOptions): Promise<MediaItem> {
  if (!options.apiKey) throw localAuthError("BCP API key is required")
  if (!options.apiKey.startsWith("bcp_sk_")) throw localAuthError("BCP API key must start with bcp_sk_")

  const category = options.category ?? "image"
  const sha = await sha256Hex(options.bytes)
  const url = new URL(options.uploadURL ?? DEFAULT_UPLOAD_URL)
  url.searchParams.set("file_name", options.fileName)
  url.searchParams.set("cate", category)
  url.searchParams.set("sha256sum", sha)

  const fetchImpl = options.fetch ?? fetch
  const response = await fetchImpl(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": options.contentType,
    },
    // Cast: TS 5.7+ types Uint8Array as `Uint8Array<ArrayBufferLike>`, but
    // BodyInit only accepts ArrayBuffer-backed views. The runtime accepts
    // both fine; this cast quiets the strict-mode mismatch.
    body: options.bytes as BodyInit,
  })

  const text = await response.text()
  const payload: unknown = text ? safeParseJSON(text) : undefined

  if (!response.ok) throw mapBCPError(response.status, payload)
  if (!payload || typeof payload !== "object") {
    throw new Error("upload worker returned a non-JSON success response")
  }

  const body = payload as UploadWorkerResponse
  if (!body.file_id || !body.ext) {
    throw new Error("upload worker response missing file_id or ext")
  }

  return {
    fid: body.file_id,
    ext: body.ext,
    media_type: category === "audio" ? "audio" : category === "video" ? "video" : "image",
    thumb_fid: body.thumb_file_id,
    blurhash: body.blurhash,
    width: body.width,
    height: body.height,
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy into a fresh ArrayBuffer-backed view so TS 5.7+ doesn't object
  // to the broader Uint8Array<ArrayBufferLike> the caller may have given us.
  // The runtime accepts either; this keeps strict types clean.
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const buffer = await crypto.subtle.digest("SHA-256", copy)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function safeParseJSON(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
