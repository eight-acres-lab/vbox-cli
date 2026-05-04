import { localAuthError, mapBCPError } from "./errors.js"
import type { BCPClientConfig } from "./types.js"

const DEFAULT_BASE_URL = "https://bcp.vboxes.org"
const API_PREFIX = "/bcp/v1"

type RequestOptions = {
  auth?: boolean
}

function validateAPIKey(apiKey: string): void {
  if (!apiKey) throw localAuthError("BCP API key is required")
  if (!apiKey.startsWith("bcp_sk_")) throw localAuthError("BCP API key must start with bcp_sk_")
}

function buildURL(baseURL: string | undefined, path: string): string {
  const origin = (baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const prefixedPath = normalizedPath.startsWith(API_PREFIX) ? normalizedPath : `${API_PREFIX}${normalizedPath}`
  return `${origin}${prefixedPath}`
}

async function parseJSON(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function requestJSON<T = unknown>(
  config: BCPClientConfig,
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  validateAPIKey(config.apiKey)

  const headers: Record<string, string> = {}
  if (body !== undefined) headers["Content-Type"] = "application/json"
  if (options.auth !== false) headers.Authorization = `Bearer ${config.apiKey}`

  const response = await (config.fetch ?? fetch)(buildURL(config.baseURL, path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await parseJSON(response)
  if (!response.ok) throw mapBCPError(response.status, payload)
  return payload as T
}
