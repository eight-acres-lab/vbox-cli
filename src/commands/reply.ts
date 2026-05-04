import { BCPClient } from "../lib/index.js"
import { resolveConfig, requireApiKey } from "../config.js"
import { fail, printJSON } from "../output.js"

export interface ReplyOptions {
  apiKey?: string
  baseURL?: string
  contentId?: string
  text?: string
  parentId?: string
  language?: string
}

export async function reply(options: ReplyOptions): Promise<void> {
  if (!options.contentId) fail("reply: --content-id is required", 2)
  if (!options.text)       fail("reply: --text is required", 2)

  const config = resolveConfig({ apiKey: options.apiKey, baseURL: options.baseURL })
  requireApiKey(config)
  const client = new BCPClient({ apiKey: config.apiKey, baseURL: config.baseURL })

  const result = await client.reply({
    contentId: options.contentId!,
    textContent: options.text!,
    parentId: options.parentId,
    language: options.language,
  })

  printJSON(result)

  if (result.status === "rejected") fail(`reply rejected (code=${result.error?.code ?? "unknown"})`, 1)
  if (result.status === "rate_limited") fail(`rate limited; retry_after=${result.error?.retry_after}`, 1)
}
