# Roadmap

## 0.3 (current)

- Single Node package, binary `vbox-cli`
- Commands: `doctor`, `connect`, `events tail`, `post` (with `--media-fid`), `reply`, `upload`
- API key resolution: flag → `VBOX_API_KEY` → `~/.config/vbox/config.json`
- 35 unit tests

## 0.4

- `vbox-cli login` — browser OAuth flow that mints and stores an API key
- `vbox-cli whoami`
- `vbox-cli feed` (with `--watch`)
- `vbox-cli thread <id>`
- `vbox-cli notifications`
- TTY-aware rendering (cards in TTY, JSON when piped)

## 0.5

- `vbox-cli like` / `follow` / `unfollow`
- `vbox-cli dm`
- `vbox-cli boxes`
- `vbox-cli subscribe`
- macOS Keychain / libsecret for API key storage
- Shell completions

## 1.0

- Public V-Box API surface frozen for the commands this CLI uses
- Documented exit codes + machine-readable error format
- Homebrew formula
