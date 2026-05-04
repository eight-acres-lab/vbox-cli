import { describe, expect, it } from "vitest"
import {
  BCPAuthError,
  BCPError,
  BCPRateLimitError,
  BCPRequestError,
  BCPServerError,
  mapBCPError,
} from "../../src/lib/errors.js"

describe("BCP errors", () => {
  it("preserves status, code, and parsed response on SDK errors", () => {
    const response = { error: { code: "bad_request", message: "Bad request" }, extra: true }
    const error = new BCPRequestError("Bad request", 400, "bad_request", response)

    expect(error).toBeInstanceOf(BCPError)
    expect(error.name).toBe("BCPRequestError")
    expect(error.status).toBe(400)
    expect(error.code).toBe("bad_request")
    expect(error.response).toBe(response)
  })

  it("represents local missing or malformed API keys as auth errors without status", () => {
    const missing = new BCPAuthError("BCP API key is required")
    const malformed = new BCPAuthError("BCP API key must start with bcp_sk_")

    expect(missing.status).toBeUndefined()
    expect(malformed.status).toBeUndefined()
    expect(missing).toBeInstanceOf(BCPAuthError)
  })

  it("stores retryAfter dates on rate limit errors", () => {
    const response = {
      error: {
        code: "rate_limited",
        message: "Too many reply actions this hour.",
        retry_after: "2026-04-27T11:00:00Z",
      },
    }
    const retryAfter = new Date("2026-04-27T11:00:00Z")
    const error = new BCPRateLimitError("Too many reply actions this hour.", 429, "rate_limited", response, retryAfter)

    expect(error.status).toBe(429)
    expect(error.code).toBe("rate_limited")
    expect(error.response).toBe(response)
    expect(error.retryAfter).toEqual(retryAfter)
  })

  it("maps structured rate_limited auth responses to rate limit errors", () => {
    const response = {
      error: {
        code: "rate_limited",
        message: "Too many requests.",
        retry_after: "2026-04-27T11:00:00Z",
      },
    }

    const error = mapBCPError(401, response)

    expect(error).toBeInstanceOf(BCPRateLimitError)
    expect(error.status).toBe(401)
    expect(error.code).toBe("rate_limited")
    expect(error.response).toBe(response)
    expect((error as BCPRateLimitError).retryAfter).toEqual(new Date("2026-04-27T11:00:00Z"))
  })

  it("provides auth, request, and server subclasses", () => {
    expect(new BCPAuthError("bad", 401)).toBeInstanceOf(BCPError)
    expect(new BCPRequestError("bad", 400)).toBeInstanceOf(BCPError)
    expect(new BCPServerError("bad", 500)).toBeInstanceOf(BCPError)
  })
})
