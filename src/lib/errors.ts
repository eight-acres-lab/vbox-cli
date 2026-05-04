// Typed error hierarchy for BCP responses. Callers should catch the most
// specific subclass first; mapBCPError() chooses the right one based on
// HTTP status and the server's error envelope.

export class BCPError extends Error {
  readonly status?: number
  readonly code?: string
  readonly response?: unknown

  constructor(message: string, status?: number, code?: string, response?: unknown) {
    super(message)
    this.name = "BCPError"
    this.status = status
    this.code = code
    this.response = response
  }
}

/** Missing / invalid / expired API key, or a 401/403 from the server. */
export class BCPAuthError extends BCPError {
  constructor(message: string, status?: number, code = "auth_error", response?: unknown) {
    super(message, status, code, response)
    this.name = "BCPAuthError"
  }
}

/** 429 with `code: "rate_limited"` — short-term rate cap. Retry after `retryAfter`. */
export class BCPRateLimitError extends BCPError {
  readonly retryAfter?: Date

  constructor(
    message: string,
    status?: number,
    code = "rate_limited",
    response?: unknown,
    retryAfter?: Date,
  ) {
    super(message, status, code, response)
    this.name = "BCPRateLimitError"
    this.retryAfter = retryAfter
  }
}

/** 429 with `code: "quota_exceeded"` — daily quota for this tier exhausted. */
export class BCPQuotaError extends BCPError {
  /** Which quota was hit, when known (`post_today`, `actions_today`, …). */
  readonly quotaKey?: string

  constructor(
    message: string,
    status?: number,
    code = "quota_exceeded",
    response?: unknown,
    quotaKey?: string,
  ) {
    super(message, status, code, response)
    this.name = "BCPQuotaError"
    this.quotaKey = quotaKey
  }
}

/** 4xx other than auth / rate / quota — request was malformed or rejected. */
export class BCPRequestError extends BCPError {
  constructor(message: string, status?: number, code?: string, response?: unknown) {
    super(message, status, code, response)
    this.name = "BCPRequestError"
  }
}

/** 5xx — upstream service is having a bad day. Retry once with backoff. */
export class BCPServerError extends BCPError {
  constructor(message: string, status?: number, code?: string, response?: unknown) {
    super(message, status, code, response)
    this.name = "BCPServerError"
  }
}

type ErrorEnvelope = {
  error?: string | {
    code?: string
    message?: string
    retry_after?: string
    quota_key?: string
  }
  message?: string
}

export function localAuthError(message: string): BCPAuthError {
  return new BCPAuthError(message)
}

function readCode(response: ErrorEnvelope): string | undefined {
  return typeof response.error === "object" ? response.error.code : undefined
}

function readMessage(response: ErrorEnvelope): string {
  if (typeof response.error === "string") return response.error
  if (typeof response.error?.message === "string") return response.error.message
  if (typeof response.message === "string") return response.message
  return "BCP request failed"
}

function readRetryAfter(response: ErrorEnvelope): Date | undefined {
  if (typeof response.error !== "object" || !response.error.retry_after) return undefined
  const d = new Date(response.error.retry_after)
  return Number.isNaN(d.valueOf()) ? undefined : d
}

function readQuotaKey(response: ErrorEnvelope): string | undefined {
  return typeof response.error === "object" ? response.error.quota_key : undefined
}

export function mapBCPError(status: number, response: unknown): BCPError {
  const envelope = response && typeof response === "object" ? (response as ErrorEnvelope) : {}
  const code = readCode(envelope)
  const message = readMessage(envelope)

  if (code === "quota_exceeded") {
    return new BCPQuotaError(message, status, code, response, readQuotaKey(envelope))
  }
  if (status === 429 || code === "rate_limited") {
    return new BCPRateLimitError(message, status, code ?? "rate_limited", response, readRetryAfter(envelope))
  }
  if (status === 401 || status === 403) {
    return new BCPAuthError(message, status, code ?? "auth_error", response)
  }
  if (status >= 400 && status < 500) {
    return new BCPRequestError(message, status, code, response)
  }
  return new BCPServerError(message, status, code, response)
}
