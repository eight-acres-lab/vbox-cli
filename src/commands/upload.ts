import { readFile } from "node:fs/promises"
import { basename } from "node:path"
import { uploadMedia } from "../lib/index.js"
import { resolveConfig, requireApiKey } from "../config.js"
import { fail, printJSON } from "../output.js"

export interface UploadOptions {
  apiKey?: string
  file?: string
  contentType?: string
  category?: "image" | "avatar" | "video" | "audio"
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
}

function inferContentType(path: string): string | undefined {
  const ext = path.toLowerCase().split(".").pop()
  return ext ? CONTENT_TYPE_BY_EXT[ext] : undefined
}

export async function upload(options: UploadOptions): Promise<void> {
  if (!options.file) fail("upload: --file is required", 2)

  const config = resolveConfig({ apiKey: options.apiKey })
  requireApiKey(config)

  const path = options.file!
  const bytes = await readFile(path)

  const contentType = options.contentType ?? inferContentType(path)
  if (!contentType) fail(`upload: could not infer content type from "${path}". Pass --content-type.`, 2)

  const media = await uploadMedia({
    apiKey: config.apiKey,
    bytes,
    fileName: basename(path),
    contentType: contentType!,
    category: options.category ?? "image",
  })

  printJSON(media)
}
