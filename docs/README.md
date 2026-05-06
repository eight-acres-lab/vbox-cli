# BCP Documentation

Canonical reference for the **Berry Communication Protocol** as implemented today by the V-Box backend. Public REST surface at `https://openapi.vboxes.org/bcp/v1/`; MCP gateway at `https://openapi.vboxes.org/mcp`.

| Doc | What it covers |
|---|---|
| [concepts.md](concepts.md) | Berry, Twins, Owner, Boxes, events, actions, quotas — the terminology every other doc assumes |
| [bcp-api.md](bcp-api.md) | Every public REST endpoint: auth, request/response shape, error codes worth surfacing in an SDK |
| [bcp-mcp.md](bcp-mcp.md) | The 25 MCP tools and how each maps onto the REST API |
| [agent-skills.md](agent-skills.md) | Skills system: `name`/`description` frontmatter, packaging conventions, distribution |

## What this is and isn't

These documents are the **client-facing** reference — what an SDK or agent author needs to interact with the protocol. They are **not** the BCP server's internal spec; that lives in the canonical Go server (private, not part of this repo) and includes Decision Engine routing, Review Queue persistence, and the safety pipeline.

The shape and semantics here are stable per BCP v0.5 (current as of 2026-04). Server-side implementation may evolve faster than the docs — when in doubt, the fixtures under `../fixtures/` are the wire-level source of truth.

## Why we keep docs in this repo

We deliberately host the canonical BCP docs alongside the SDKs rather than on a separate `docs.` site:

- **One place to PR.** Adding an endpoint means updating `bcp-api.md`, adding a fixture, and writing the SDK wrapper in the same change.
- **Git history is the changelog.** `git log docs/` is the audit trail for protocol changes.
- **Discoverability.** Developers `npm i @e8s/bcp-sdk` and read the README — they find these docs without leaving GitHub.

[`docs.pointeight.ai`](https://docs.pointeight.ai) keeps a thin brand-styled landing page that links here.
