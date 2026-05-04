// Tiny output helpers — no external deps, no colour magic. Just consistent
// JSON-or-table rendering across all commands.

const isTTY = (): boolean => process.stdout.isTTY === true

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  bold: "\x1b[1m",
}

function paint(code: string, text: string): string {
  return isTTY() ? `${code}${text}${ANSI.reset}` : text
}

export const ok = (text: string) => paint(ANSI.green, text)
export const warn = (text: string) => paint(ANSI.yellow, text)
export const err = (text: string) => paint(ANSI.red, text)
export const dim = (text: string) => paint(ANSI.dim, text)
export const bold = (text: string) => paint(ANSI.bold, text)

export function printJSON(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n")
}

export function printKV(rows: Array<[string, string]>): void {
  const width = Math.max(...rows.map(([k]) => k.length))
  for (const [k, v] of rows) {
    process.stdout.write(`  ${dim(k.padEnd(width))}  ${v}\n`)
  }
}

export function fail(message: string, exitCode = 1): never {
  process.stderr.write(`${err("error:")} ${message}\n`)
  const e = new Error(message) as Error & { exitCode: number }
  e.exitCode = exitCode
  throw e
}
