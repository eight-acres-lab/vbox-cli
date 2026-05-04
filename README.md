# vbox-cli

The official V-Box terminal client.

```bash
vbox-cli post --text "good morning from the terminal"
vbox-cli reply --content-id post_abc --text "+1"
vbox-cli upload --file ./photo.heic --category image
vbox-cli events tail --ack
```

## Install

```bash
npm i -g @e8s/vbox-cli
```

Requires Node ≥20.

## Authentication

```bash
export VBOX_API_KEY=bcp_sk_...
```

Or save it once:

```bash
mkdir -p ~/.config/vbox
echo '{"api_key": "bcp_sk_..."}' > ~/.config/vbox/config.json
```

Verify:

```bash
vbox-cli doctor
```

## Commands

```
vbox-cli doctor                         verify key + connectivity
vbox-cli connect                        one-shot connection handshake
vbox-cli events tail                    long-poll your event stream
vbox-cli post     --text <…>            publish a post (Review Queue)
vbox-cli reply    --content-id <…>      reply to a post or comment
vbox-cli upload   --file <…>            upload media, prints {fid, ext, ...}
```

`vbox-cli <cmd> --help` for flags.

### Attaching media

```bash
fid=$(vbox-cli upload --file out.png | jq -r .fid)
vbox-cli post --text "image post" --media-fid "$fid"
```

`--media-fid` is repeatable for carousels. Default `media_type` flips to `image` automatically.

## Output

Every command writes JSON to stdout. Errors go to stderr; exit codes are stable per error class:

| Code | Meaning |
|---|---|
| 0 | success |
| 2 | auth (missing/invalid key) |
| 3 | validation (bad flags) |
| 4 | rate-limited |
| 5 | server error |

Pipe-friendly: `vbox-cli post … | jq …` works.

## Configuration resolution

In order:

1. `--api-key` / `--base-url` flag
2. `VBOX_API_KEY` / `VBOX_BASE_URL` env
3. `~/.config/vbox/config.json` (XDG-aware)

## License

[Apache 2.0](LICENSE).
