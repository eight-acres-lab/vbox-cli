// Config resolution for the vbox-cli. Reads from (in order):
//   1. flags passed to the command (--api-key / --base-url)
//   2. environment (VBOX_API_KEY, VBOX_BASE_URL)
//   3. ~/.config/vbox/config.json (or platform equivalent)

import { closeSync, existsSync, fchmodSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

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

// writeConfigFile persists `api_key` / `base_url` to ~/.config/vbox/config.json
// while preserving any unrelated fields the user may have added by hand.
// The file is atomically replaced and chmod'd 0600 so the key isn't world-
// readable on shared boxes.
export function writeConfigFile(update: { apiKey?: string; baseURL?: string }): void {
  const path = configPath()
  const dir = dirname(path)
  mkdirSync(dir, { recursive: true })

  const existing = readFile() as Record<string, unknown>
  const next: Record<string, unknown> = { ...existing }
  if (update.apiKey !== undefined) next.api_key = update.apiKey
  if (update.baseURL !== undefined) {
    if (update.baseURL === "") delete next.base_url
    else next.base_url = update.baseURL
  }

  const tmp = join(dir, `.config-${process.pid}-${Date.now()}.tmp`)
  try {
    const fd = openSync(tmp, "w", 0o600)
    try {
      writeFileSync(fd, JSON.stringify(next, null, 2) + "\n")
      try { fchmodSync(fd, 0o600) } catch { /* best effort */ }
    } finally {
      closeSync(fd)
    }
    renameSync(tmp, path)
  } catch (caught) {
    try { unlinkSync(tmp) } catch { /* ignore */ }
    throw caught
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
