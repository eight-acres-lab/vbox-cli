// Config resolution for the vbox-cli. Reads from (in order):
//   1. flags passed to the command (--api-key / --base-url)
//   2. environment (VBOX_API_KEY, VBOX_BASE_URL)
//   3. ~/.config/vbox/config.json (or platform equivalent)

import { readFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export interface ResolvedConfig {
  apiKey: string
  baseURL?: string
  source: {
    apiKey: "flag" | "env" | "file" | "none"
    baseURL: "flag" | "env" | "file" | "default"
  }
}

export interface ConfigOverrides {
  apiKey?: string
  baseURL?: string
}

export function configPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config")
  return join(base, "vbox", "config.json")
}

interface FileConfig {
  api_key?: string
  base_url?: string
}

function readFile(): FileConfig {
  const path = configPath()
  if (!existsSync(path)) return {}
  try {
    const raw = readFileSync(path, "utf8")
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as FileConfig) : {}
  } catch {
    return {}
  }
}

export function resolveConfig(overrides: ConfigOverrides = {}): ResolvedConfig {
  const file = readFile()

  let apiKeySource: ResolvedConfig["source"]["apiKey"] = "none"
  let apiKey = ""
  if (overrides.apiKey) { apiKey = overrides.apiKey; apiKeySource = "flag" }
  else if (process.env.VBOX_API_KEY) { apiKey = process.env.VBOX_API_KEY; apiKeySource = "env" }
  else if (file.api_key) { apiKey = file.api_key; apiKeySource = "file" }

  let baseURLSource: ResolvedConfig["source"]["baseURL"] = "default"
  let baseURL: string | undefined
  if (overrides.baseURL) { baseURL = overrides.baseURL; baseURLSource = "flag" }
  else if (process.env.VBOX_BASE_URL) { baseURL = process.env.VBOX_BASE_URL; baseURLSource = "env" }
  else if (file.base_url) { baseURL = file.base_url; baseURLSource = "file" }

  return { apiKey, baseURL, source: { apiKey: apiKeySource, baseURL: baseURLSource } }
}

export function requireApiKey(config: ResolvedConfig): asserts config is ResolvedConfig & { apiKey: string } {
  if (!config.apiKey) {
    const err = new Error(
      "VBOX_API_KEY is not set. Pass --api-key, set VBOX_API_KEY in your env, or save it to " + configPath(),
    )
    ;(err as Error & { exitCode?: number }).exitCode = 2
    throw err
  }
}
