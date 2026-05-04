# CLAUDE.md — vbox-cli

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## What this is

`vbox-cli` is the **official V-Box terminal client** — a single-binary Node CLI that lets a user (or an automated script) post, reply, browse, and upload to V-Box from the shell. It's the developer-facing wing of [Point Eight AI](https://pointeight.ai), packaged under the **Eight Acres** open-source umbrella (`eight-acres-lab` GitHub org, `e8s` npm scope).

> Repo URL: https://github.com/eight-acres-lab/vbox-cli
> npm package: `@e8s/vbox-cli` (binary `vbox-cli`)
> See `../../CLAUDE.md` (workspace root) for the full V-Box / Berry / Point Eight context. The V-Box server itself is in the proprietary workspace (`backend/`, `bcp/`, `berry/`); this repo is the **public client**, not the server.

## Layout

```
vbox-cli/
├── README.md, LICENSE (Apache 2.0), CONTRIBUTING.md, SECURITY.md, ...
├── package.json                # single npm package, type:module, bin: vbox-cli
├── tsconfig.json               # NodeNext, strict
├── bin/vbox-cli.js             # ESM shim → dist/cli.js
├── src/
│   ├── cli.ts                  # commander setup, subcommand routing
│   ├── config.ts               # API-key resolution (flag / env / file)
│   ├── output.ts               # ANSI / JSON output helpers
│   ├── commands/               # one file per subcommand (post, reply, …)
│   └── lib/                    # internal HTTP client to the BCP API
├── test/lib/                   # vitest suites (30 tests, fixture-driven)
├── fixtures/                   # cross-language wire-contract JSON
│   ├── events/
│   └── responses/
├── scripts/check-fixtures.cjs  # validates every fixtures/**/*.json parses
└── .github/workflows/ci.yml    # Node 20 + 22 matrix
```

The `src/lib/` modules are an HTTP client to the BCP REST surface (`openapi.vboxes.org/bcp/v1/`). They are **internal** — the package exposes only the `vbox-cli` binary, not a library API. If you need to script V-Box from Node, shell out to `vbox-cli`; do not depend on `@e8s/vbox-cli`'s exports.

## Commands

```bash
npm install
npm run build         # tsc → dist/
npm test              # vitest run, 30 tests
npm run typecheck     # tsc --noEmit
npm run fixtures:check
node bin/vbox-cli.js --help
```

Local-without-publish run:

```bash
npm run build && node bin/vbox-cli.js doctor
```

## Conventions

- **Output**: every command prints JSON to stdout for machine consumption. Human-readable formatting goes to stderr or behind a TTY check (see `src/output.ts`). This is non-negotiable — scripts depend on it.
- **Exit codes**: 0 success / 2 auth / 3 validation / 4 rate-limit / 5 server. Mapped from `BCP*Error` in `src/lib/errors.ts`. Don't invent new codes; map to existing ones.
- **Env vars**: `VBOX_API_KEY`, `VBOX_BASE_URL`. Never `BCP_*` (that was the old SDK identity).
- **Config path**: `~/.config/vbox/config.json` (XDG-aware on Linux). Don't read `~/.config/bcp/`.
- **Imports**: from inside `src/commands/`, import the lib via `from "../lib/index.js"` (the `.js` extension is required by NodeNext + ESM).

## Adding a new command

1. Create `src/commands/<name>.ts` exporting a function that takes typed options.
2. Wire it in `src/cli.ts` with `withCommon(program.command(...))`.
3. Use `resolveConfig()` + `requireApiKey()` for auth.
4. Catch `BCP*Error` and `fail()` (from `output.ts`) with the right exit code.
5. Print results via `printJSON(...)`.
6. Add a vitest test under `test/commands/` (CLI tests are a v0.4 gap — see ROADMAP).

## What this repo is **not**

- Not a multi-language SDK monorepo. The previous `packages/{python,go}/` paths were placeholder-only and have been deleted.
- Not a library for building agents. `BerryAgent` (in `src/lib/agent.ts`) is internal infrastructure used by `events tail`; it is not exported as a public Node API. Agent runtimes live in [openmelon](https://github.com/eight-acres-lab/openmelon).
- Not a desktop GUI. A future GUI (if it happens) will live in a separate repo.

## Versioning

- 0.3.x — current; mechanical baseline.
- 0.4.x — login + reading commands.
- 0.5.x — daily-driver completeness.
- 1.0 — stable public surface, frozen exit codes / output shape.

See [`ROADMAP.md`](ROADMAP.md) for what each version unlocks.

## Auth, briefly

V-Box mints API keys in the developer portal. Keys begin with `vbox_sk_`. The CLI validates the prefix locally before any network call to surface mistyped keys early. There is no cookie / browser-session mode — every command is bearer-authenticated.

`vbox-cli login` (planned for 0.4) will run a browser-based OAuth flow that writes a key to the config file with `chmod 600`. Until then, mint a key in-app and either set `VBOX_API_KEY` or write `~/.config/vbox/config.json` by hand.
