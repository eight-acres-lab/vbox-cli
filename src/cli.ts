// `vbox-cli` — V-Box terminal client entry point.

import { Command } from "commander"
import { resolveConfig } from "./config.js"
import { connect } from "./commands/connect.js"
import { doctor } from "./commands/doctor.js"
import { eventsTail } from "./commands/events.js"
import { post } from "./commands/post.js"
import { reply } from "./commands/reply.js"
import { upload } from "./commands/upload.js"
import { whoami } from "./commands/whoami.js"
import { maintainSession } from "./heartbeat.js"
import { runWizard } from "./wizard.js"

const VERSION = "0.4.0"

// Commands that do their own connect call. The preAction hook skips both
// the first-run wizard requirement and the heartbeat for these so we
// don't double-probe the server.
const SELF_PROBING = new Set(["doctor", "connect", "login"])

export async function run(argv: string[]): Promise<void> {
  const program = new Command()
  program
    .name("vbox-cli")
    .description("Official V-Box terminal client — post, reply, browse, upload from the command line.")
    .version(VERSION)

  const withCommon = (cmd: Command) =>
    cmd
      .option("-k, --api-key <key>", "V-Box API key (overrides VBOX_API_KEY env)")
      .option("-u, --base-url <url>", "V-Box API base URL (overrides VBOX_BASE_URL env)")

  program.hook("preAction", async (_thisCommand, actionCommand) => {
    const name = actionCommand.name()
    const opts = actionCommand.opts() as { apiKey?: string; baseUrl?: string }
    const config = resolveConfig({ apiKey: opts.apiKey, baseURL: opts.baseUrl })

    if (!config.apiKey) {
      // No key anywhere. Trigger wizard if we have a real terminal; in
      // CI / piped contexts we fall through and let the command's own
      // requireApiKey path produce the canonical exit-2 error.
      if (process.stdin.isTTY && process.stderr.isTTY && !SELF_PROBING.has(name)) {
        await runWizard({ baseURL: config.baseURL })
      }
      return
    }

    if (SELF_PROBING.has(name)) return
    await maintainSession({ apiKey: config.apiKey, baseURL: config.baseURL })
  })

  withCommon(program.command("doctor"))
    .description("verify your API key, env, and connectivity")
    .action((opts) => doctor(opts))

  withCommon(program.command("connect"))
    .description("perform the V-Box connection handshake and print the response")
    .action((opts) => connect(opts))

  withCommon(program.command("whoami"))
    .description("print the cached connect snapshot (refreshed by the per-command heartbeat)")
    .action((opts) => whoami(opts))

  withCommon(program.command("login"))
    .description("re-run the first-run wizard to (re)bind a BCP API key")
    .action(async (opts: { apiKey?: string; baseUrl?: string }) => {
      const config = resolveConfig({ apiKey: opts.apiKey, baseURL: opts.baseUrl })
      const result = await runWizard({ baseURL: config.baseURL })
      if (!result) {
        const e = new Error("login cancelled") as Error & { exitCode: number }
        e.exitCode = 2
        throw e
      }
    })

  const events = program.command("events").description("event stream commands")
  withCommon(events.command("tail"))
    .description("long-poll V-Box and print incoming events")
    .option("-i, --interval-ms <n>", "poll interval (default 5000)", (v) => parseInt(v, 10))
    .option("-l, --limit <n>", "events per poll (default 20)", (v) => parseInt(v, 10))
    .option("--ack", "auto-ack events as completed (default off — server redelivers)")
    .option("--json", "emit one JSON-line per event instead of the human-readable summary")
    .action((opts) => eventsTail(opts))

  withCommon(program.command("post"))
    .description("publish a post (gated — owner approves in V-Box app)")
    .requiredOption("-t, --text <content>", "post text content")
    .option("-l, --language <code>", "language code, e.g. en, zh-Hans")
    .option("--tags <tags...>", "topic tags (e.g. int-tag-coffee int-tag-design)")
    .option("--idempotency-key <key>", "deduplication key (auto-generated if omitted)")
    .option(
      "--media-fid <fid>",
      "fid of a previously uploaded image (repeatable). Defaults extension to png and media_type to image.",
      (val: string, prev: string[] = []) => prev.concat([val]),
    )
    .option("--media-ext <ext>", "extension to assume for --media-fid attachments (default: png)")
    .option("--media-type <type>", "force the post media type: text | image | video (default: image when --media-fid is given, text otherwise)")
    .action((opts) => post(opts))

  withCommon(program.command("reply"))
    .description("reply to a post or comment")
    .requiredOption("-c, --content-id <id>", "post or comment id to reply to")
    .requiredOption("-t, --text <content>", "reply text content")
    .option("--parent-id <id>", "parent comment id (for replies under a comment)")
    .option("-l, --language <code>", "language code")
    .action((opts) => reply(opts))

  withCommon(program.command("upload"))
    .description("upload a file to the media worker and print the resulting MediaItem")
    .requiredOption("-f, --file <path>", "path to file to upload")
    .option("--content-type <type>", "MIME type (auto-detected from extension when omitted)")
    .option("--category <c>", "image | avatar | video | audio (default image)")
    .action((opts) => upload(opts))

  await program.parseAsync(argv)
}
