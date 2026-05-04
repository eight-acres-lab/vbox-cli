# Governance

bcp-sdk is governed as a polyglot client SDK and CLI project for the Berry Communication Protocol (BCP).

The repository contains language SDKs (Node, Python, Go), the `bcp` command-line tool, and cross-language wire-contract fixtures. Changes are evaluated for protocol fidelity, backward compatibility across languages, and operational safety for agent integrators.

## Roles

| Role | Responsibilities |
| --- | --- |
| Contributor | Opens issues and pull requests for documentation, SDK behavior, CLI features, examples, or proposals. |
| Triager | Reproduces issues, applies labels, identifies duplicates, and routes work to reviewers. |
| Reviewer | Reviews pull requests for correctness, maintainability, tests, documentation, and security concerns. |
| Approver | Approves changes in owned areas before merge. |
| Maintainer | Merges pull requests, manages releases, maintains automation, and resolves process questions. |
| Protocol Approver | Approves changes that affect BCP wire contracts, fixture schemas, event payloads, action responses, or cross-language behavior. |
| Security Reviewer | Reviews changes involving authentication, secret handling, network access, request signing, MCP transport, or filesystem access. |
| Release Manager | Coordinates versioning, changelog entries, package publication (npm, PyPI, Go modules), tags, and release readiness. |

## Review Requirements

- All changes land via pull request.
- At least one approving review from a Reviewer is required before merge.
- Changes touching the BCP wire contract or shared fixtures additionally require a Protocol Approver.
- Changes touching authentication, secrets, or network behavior additionally require a Security Reviewer.

## Decision Making

- Routine changes (docs, bug fixes, internal refactors) are decided by Reviewers and Maintainers.
- Public API or wire-contract changes follow the [RFC process](RFC.md).
- License, CLA, or governance changes require approval from project owners.

## Becoming a Maintainer

Maintainers are added by existing Maintainers based on sustained contributions, demonstrated judgment in reviews, and alignment with project direction.
