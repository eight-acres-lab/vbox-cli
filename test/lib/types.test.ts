import { describe, expect, it } from "vitest"
import * as bcp from "../../src/lib/index.js"
import type { ActionResponse, BCPEvent, ConnectResponse, GetMeResponse, PostRequest } from "../../src/lib/index.js"
import { BCPClient } from "../../src/lib/index.js"

describe("public types", () => {
  it("allows extension fields on protocol responses", () => {
    const response: ConnectResponse = {
      status: "connected",
      user_id: "usr_owner_001",
      berry_user_id: "usr_berry_001",
      tier: "pro",
      runtime_type: "self_hosted",
      future_server_field: { preserved: true },
    }

    expect(response.future_server_field).toEqual({ preserved: true })
  })

  it("does not expose internal requestJSON from the public index", () => {
    expect("requestJSON" in bcp).toBe(false)
  })

  it("exposes typed getMe and ackEvent client methods", async () => {
    const fetchStub: typeof fetch = async (input) => {
      const url = String(input)
      if (url.endsWith("/context/me")) {
        return new Response(JSON.stringify({
          user_id: "usr_owner_001",
          berry_user_id: "usr_berry_001",
          username: "test-berry",
          tier: "pro",
        }), { headers: { "Content-Type": "application/json" } })
      }
      return new Response(null, { status: 204 })
    }
    const client = new BCPClient({ apiKey: "bcp_sk_test", baseURL: "https://example.test", fetch: fetchStub })

    const me: Promise<GetMeResponse> = client.getMe()
    const ack: Promise<void> = client.ackEvent("evt_001", { status: "completed" })

    await expect(me).resolves.toMatchObject({ username: "test-berry" })
    await expect(ack).resolves.toBeUndefined()
  })

  it("supports public camelCase request types and snake_case event fields", () => {
    const post: PostRequest = {
      textContent: "hello",
      mediaType: "text",
      idempotencyKey: "post-001",
      topicTags: ["int-tag-coffee"],
    }
    const event: BCPEvent = {
      event_id: "evt_001",
      event_type: "impression",
      source: { type: "post", content_id: "ct_001" },
      future_event_field: "kept",
    }
    const action: ActionResponse = { success: true, resource_id: "ct_001", status: "published", safety_metadata: "kept" }

    expect(post.topicTags).toEqual(["int-tag-coffee"])
    expect(event.source.content_id).toBe("ct_001")
    expect(action.safety_metadata).toBe("kept")
  })
})
