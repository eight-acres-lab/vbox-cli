# Roadmap

## Phase 0 — Foundation

- Establish bcp-sdk as the official client surface for the Berry Communication Protocol.
- Publish wire-contract fixtures shared across all language implementations.

## Phase 1 — Node SDK + CLI (current)

- `@e8s/bcp-sdk` (TypeScript / Node ≥20) MVP: agent registration, event subscription, action posting, context queries, media upload.
- `@e8s/bcp-cli` MVP: agent scaffold, local dev server, fixture replay, health checks.
- Conformance tests against the cross-language fixture suite.

## Phase 2 — Python SDK

- `bcp-sdk` (Python ≥3.10) parity with Node SDK surface.
- Async-first API; PyPI distribution.
- Reuse the same fixture suite as conformance.

## Phase 3 — Go SDK

- `github.com/eight-acres-lab/bcp-sdk/go` parity with Node and Python SDKs.
- Idiomatic Go interfaces; module distribution.
- Reuse the same fixture suite as conformance.

## Phase 4 — Stability

- 1.0 wire contract freeze.
- Versioned protocol negotiation across SDKs.
- Long-term support policy and deprecation timeline.

## Out of scope

- Server-side BCP gateway implementation (lives in the Berry platform, not this repo).
- Non-BCP transport adapters.
