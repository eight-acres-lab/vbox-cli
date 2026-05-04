# CLAUDE.md — vbox-cli

Guidance for Claude Code (claude.ai/code) when working in this repo.

## What this is

`vbox-cli` is the official V-Box terminal client. Single-binary Node CLI; the `src/lib/` modules are an internal HTTP client to the BCP REST surface, not exported as a public Node API. To script V-Box from Node, shell out to `vbox-cli` — do not depend on `@e8s/vbox-cli`'s exports.

## Layout

```
package.json            # @e8s/vbox-cli, type:module, bin: vbox-cli
tsconfig.json           # NodeNext, strict
bin/vbox-cli.js         # ESM shim → dist/cli.js
src/
  cli.ts                # commander setup
  config.ts             # API-key resolution
  output.ts             # ANSI / JSON helpers
  commands/             # one file per subcommand
  lib/                  # internal HTTP client to BCP REST
test/lib/               # vitest, fixture-driven (30 cases)
test/commands/          # vitest, fetch-intercepting (5 cases)
fixtures/               # cross-language wire-contract JSON
scripts/check-fixtures.cjs
.github/workflows/ci.yml
```

## Commands

```bash
npm install
npm run build           # tsc → dist/
npm test                # vitest run, 35 tests
npm run typecheck
npm run fixtures:check
node bin/vbox-cli.js --help
```

## Conventions

- **Output is JSON to stdout.** Every command. Scripts depend on it. Human-readable formatting goes to stderr or behind a TTY check.
- **Exit codes**: 0 / 2 / 3 / 4 / 5. See README. Don't invent new codes.
- **Env vars**: `VBOX_API_KEY`, `VBOX_BASE_URL`. Never `BCP_*`.
- **Config path**: `~/.config/vbox/config.json` (XDG-aware on Linux).
- **Imports**: from `src/commands/`, import the lib via `from "../lib/index.js"` (the `.js` extension is required by NodeNext + ESM).
- **Key prefix validation** (`src/lib/http.ts`): keys must start with `bcp_sk_`. The V-Box server mints BCP keys; the env var name changed in the rebrand but the key format did not.

## Adding a new command

1. `src/commands/<name>.ts` exporting a function with typed options.
2. Wire it in `src/cli.ts` with `withCommon(program.command(...))`.
3. Use `resolveConfig()` + `requireApiKey()` for auth.
4. Catch `BCP*Error` from `src/lib/errors.ts` and map to `fail(msg, exitCode)`.
5. Print results via `printJSON(...)`.
6. Add a fetch-intercepting test under `test/commands/`.
