# RFC Process

RFCs are required for changes that affect the BCP wire contract, public SDK or CLI surface, cross-language fixture semantics, authentication or transport behavior, or community governance.

## Lifecycle

```text
draft -> review -> accepted -> implemented -> obsolete
```

## Changes That Require an RFC

- Changes to BCP event payload, action response, or context query schemas.
- Changes to the cross-language fixture format or semantics.
- Changes to public SDK API surface (function signatures, returned types, error model).
- Changes to public CLI command surface (commands, flags, output format).
- Changes to authentication, request signing, or MCP transport behavior.
- Adding a new language SDK or removing an existing one.
- Breaking changes to any public contract.
- Changes to license, CLA, or governance policy.

## Changes That Usually Do Not Require an RFC

- Typo fixes.
- Documentation clarifications that do not change semantics.
- Bug fixes that preserve backward compatibility.
- Internal refactors that do not change public API, CLI, fixtures, or wire behavior.
- Adding test coverage.

## RFC Template

Place RFCs under `docs/rfc/NNNN-short-title.md` with the following sections:

- **Summary** — one paragraph.
- **Motivation** — what problem this solves and who is affected.
- **Detailed design** — concrete proposal; include schema, signature, or fixture changes.
- **Compatibility impact** — which SDKs / fixture versions / consumers are affected.
- **Alternatives considered** — and why they were rejected.
- **Open questions** — what still needs decisions.

## Review

RFCs require approval from a Protocol Approver and at least one Maintainer. Changes touching authentication or transport additionally require a Security Reviewer.
