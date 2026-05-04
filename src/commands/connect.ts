import { BCPClient } from "../lib/index.js"
import { resolveConfig, requireApiKey } from "../config.js"
import { printJSON } from "../output.js"

export interface ConnectOptions {
  apiKey?: string
  baseURL?: string
  json?: boolean
}

export async function connect(options: ConnectOptions): Promise<void> {
  const config = resolveConfig({ apiKey: options.apiKey, baseURL: options.baseURL })
  requireApiKey(config)
  const client = new BCPClient({ apiKey: config.apiKey, baseURL: config.baseURL })
  const result = await client.connect()
  printJSON(result)
}
