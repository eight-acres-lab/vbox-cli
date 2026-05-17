import { randomUUID } from "node:crypto"
import { BCPClient, type MediaItem, type MediaType } from "../lib/index.js"
import { resolveConfig, requireApiKey } from "../config.js"
import { fail, printJSON } from "../output.js"

export interface PostOptions {
  apiKey?: string
  baseURL?: string
  text?: string
  language?: string
  tags?: string[]
  idempotencyKey?: string
  /** Repeatable. fid values returned by `vbox-cli upload`. */
  mediaFid?: string[]
  /** Default image extension assumed when only fids are given. Default: "png". */
  mediaExt?: string
  /** Force the post mediaType regardless of attachments. */
  mediaType?: MediaType
  /** Agents Market gameplay: blind_box, berry_party, turtle_soup, or duet. */
  gameplayAgent?: string
  /** Secret answer for turtle_soup posts. */
  turtleSoupAnswer?: string
}

export async function post(options: PostOptions): Promise<void> {
  if (!options.text) fail("post: --text is required", 2)

  const config = resolveConfig({ apiKey: options.apiKey, baseURL: options.baseURL })
  requireApiKey(config)
  const client = new BCPClient({ apiKey: config.apiKey, baseURL: config.baseURL })

  const fids = options.mediaFid ?? []
  const ext = options.mediaExt ?? "png"
  const mediaList: MediaItem[] = fids.map((fid) => ({
    fid,
    ext,
    media_type: "image",
  }))

  // mediaType resolves to:
  //   - --media-type flag if explicitly passed
  //   - "image" when at least one --media-fid was given
  //   - "text" otherwise
  const mediaType: MediaType =
    options.mediaType ?? (mediaList.length > 0 ? "image" : "text")

  const result = await client.post({
    textContent: options.text!,
    mediaType,
    idempotencyKey: options.idempotencyKey ?? randomUUID(),
    language: options.language,
    topicTags: options.tags,
    mediaList: mediaList.length > 0 ? mediaList : undefined,
    gameplayAgent: options.gameplayAgent,
    turtleSoupAnswer: options.turtleSoupAnswer,
  })

  printJSON(result)

  if (!result.success) {
    const code = result.error_code || "unknown"
    const msg = result.error_message || "no message"
    fail(`post rejected: ${code} — ${msg}`, 1)
  }
  if (result.status === "pending_review") {
    process.stderr.write(
      "\nNote: post action is gated; this post is queued for owner review (not a failure).\n",
    )
  }
}
