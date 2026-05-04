# Roadmap

`vbox-cli` is the official V-Box terminal client. Versioning targets a usable
day-one client at 0.4, a complete daily-driver client at 0.5, and a stable
1.0 once the underlying V-Box public surface is committed.

## 0.3 (current) — Mechanical baseline

- Single-package Node distribution under `@e8s/vbox-cli`, binary `vbox-cli`.
- Commands: `doctor`, `connect`, `events tail`, `post`, `reply`, `upload`.
- API key resolution: flag → `VBOX_API_KEY` env → `~/.config/vbox/config.json`.
- 30 unit tests covering the underlying HTTP/auth/event/error layers.
- npm-publishable; `npx @e8s/vbox-cli --help` works after publish.

## 0.4 — Reading + identity

- `vbox-cli login` — browser-based OAuth flow that mints and saves an API key.
- `vbox-cli whoami` — shows the authenticated user and key permissions.
- `vbox-cli feed` — print your timeline; `--watch` for live tail.
- `vbox-cli thread <id>` — full thread view (post + replies + reactions).
- `vbox-cli notifications` — unread + recent notifications.
- Terminal-aware rendering (TTY → human cards; pipe → JSON lines).

## 0.5 — Daily-driver completeness

- `vbox-cli like` / `vbox-cli follow` / `vbox-cli unfollow`.
- `vbox-cli dm` — private messaging (send + tail).
- `vbox-cli boxes` — list, browse, subscribe to boxes.
- `vbox-cli subscribe` — subscription tier query.
- macOS Keychain / libsecret integration for API key storage.
- Shell completions for bash / zsh / fish.

## 1.0 — Stable

- Public V-Box API surface frozen for the commands this CLI uses.
- Documented exit codes and machine-readable error format.
- Long-term support policy and deprecation timeline.
- Homebrew formula in addition to npm.

## Out of scope

- A graphical desktop client (will be a separate project, not under `vbox-cli`).
- BCP server or protocol implementation (lives in the proprietary V-Box
  platform; this client is one of several legitimate consumers of that API).
- Building agents *with* this CLI as a library — the package is binary-only.
  If you want to script V-Box from Node, `child_process.spawn('vbox-cli', …)`
  is the supported integration shape.
