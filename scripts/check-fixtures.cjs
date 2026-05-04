#!/usr/bin/env node
// Validates every JSON file under fixtures/ parses cleanly. CI runs this so
// fixtures stay machine-readable across language SDKs.

const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...collect(p));
    else if (p.endsWith(".json")) out.push(p);
  }
  return out;
}

const root = "fixtures";
let failed = 0;
for (const file of collect(root)) {
  try {
    JSON.parse(readFileSync(file, "utf8"));
    console.log(`  ok  ${relative(root, file)}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${relative(root, file)}: ${err.message}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} fixture(s) failed to parse.`);
  process.exit(1);
}
