#!/usr/bin/env node
// Entry point for the `vbox-cli` binary. Loads the compiled ESM and runs.
import { run } from "../dist/cli.js"

run(process.argv).catch((err) => {
  if (err && typeof err === "object" && "exitCode" in err) {
    process.exit(err.exitCode)
  }
  console.error(err && err.stack ? err.stack : err)
  process.exit(1)
})
