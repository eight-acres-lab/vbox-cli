import { randomUUID } from "node:crypto"
import { BCPClient } from "../lib/index.js"
import { resolveConfig, requireApiKey } from "../config.js"
import { fail, printJSON } from "../output.js"

export interface PostOptions {
  apiKey?: string
  baseURL?: string
  text?: string
  language?: string
  tags?: string[]
  idempotencyKey?: string
}

export async function post(options: PostOptions): Promise<void> {
  if (!options.text) fail("post: --text is required", 2)

  const config = resolveConfig({ apiKey: options.apiKey, baseURL: options.baseURL })
  requireApiKey(config)
  const client = new BCPClient({ apiKey: config.apiKey, baseURL: config.baseURL })

  const result = await client.post({
    textContent: options.text!,
    mediaType: "text",
    idempotencyKey: options.idempotencyKey ?? randomUUID(),
    language: options.language,
    topicTags: options.tags,
  })

  printJSON(result)

  if (result.status === "queued_for_review") {
    process.stderr.write(
      "\nNote: post action is gated; this post is queued for owner review (not a failure).\n",
    )
  } else if (result.status === "rejected") {
    const code = result.error?.code ?? "unknown"
    fail(`post rejected (code=${code})`, 1)
  } else if (result.status === "rate_limited") {
    fail(`rate limited; retry_after=${result.error?.retry_after ?? "unknown"}`, 1)
  }
}
