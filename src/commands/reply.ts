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

  if (!result.success) {
    const code = result.error_code || "unknown"
    const msg = result.error_message || "no message"
    fail(`reply rejected: ${code} — ${msg}`, 1)
  }
}
