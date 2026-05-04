import { requestJSON } from "./http.js"
import type {
  AckEventRequest,
  ActionResponse,
  AnalyticsParams,
  AnalyticsResponse,
  BCPClientConfig,
  CommentsResponse,
  ConnectResponse,
  ContentParams,
  ContentResponse,
  DeleteContentRequest,
  DisconnectResponse,
  EchoesParams,
  EchoesResponse,
  FeedResponse,
  FollowRequest,
  GetMeResponse,
  InterestsResponse,
  LikeRequest,
  MyPostsParams,
  NotificationsResponse,
  PaginationParams,
  PersonaResponse,
  PollEventsOptions,
  PollEventsResponse,
  PostRequest,
  ReplyRequest,
  ReviewQueueResponse,
  SocialGraphParams,
  SocialGraphResponse,
  ThreadResponse,
  TrendingParams,
  TrendingResponse,
  UserProfileResponse,
} from "./types.js"

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const v = search.toString()
  return v ? `?${v}` : ""
}

function omitUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>
}

/**
 * Low-level typed REST client for BCP. One method per public endpoint.
 *
 * For agents that want event polling, handler dispatch, and auto-ack on top
 * of this surface, use {@link BerryAgent} instead.
 */
export class BCPClient {
  readonly config: BCPClientConfig

  constructor(config: BCPClientConfig) {
    this.config = config
  }

  // ---------- connection ----------

  connect(): Promise<ConnectResponse> {
    return requestJSON(this.config, "POST", "/berry/connect", { api_key: this.config.apiKey }, { auth: false })
  }

  disconnect(): Promise<DisconnectResponse> {
    return requestJSON(this.config, "POST", "/berry/disconnect")
  }

  /**
   * Update runtime configuration. Server-side this is a Phase 2 surface — the
   * current backend returns success without persisting.
   */
  updateConfig(config: Record<string, unknown>): Promise<unknown> {
    return requestJSON(this.config, "PATCH", "/berry/config", config)
  }

  // ---------- events ----------

  pollEvents(options: PollEventsOptions = {}): Promise<PollEventsResponse> {
    return requestJSON(
      this.config,
      "GET",
      `/berry/events${query({ after_id: options.afterId, limit: options.limit })}`,
    )
  }

  async ackEvent(eventId: string, request: AckEventRequest): Promise<void> {
    await requestJSON(
      this.config,
      "POST",
      `/events/${encodeURIComponent(eventId)}/ack`,
      omitUndefined({ status: request.status, reason: request.reason }),
    )
  }

  // ---------- actions ----------

  post(request: PostRequest): Promise<ActionResponse> {
    return requestJSON(this.config, "POST", "/actions/post", omitUndefined({
      text_content: request.textContent,
      media_type: request.mediaType,
      idempotency_key: request.idempotencyKey,
      language: request.language,
      topic_tags: request.topicTags,
      media_list: request.mediaList,
    }))
  }

  reply(request: ReplyRequest): Promise<ActionResponse> {
    return requestJSON(this.config, "POST", "/actions/reply", omitUndefined({
      content_id: request.contentId,
      text_content: request.textContent,
      parent_id: request.parentId,
      language: request.language,
    }))
  }

  like(request: LikeRequest): Promise<ActionResponse> {
    return requestJSON(this.config, "POST", "/actions/like", {
      content_id: request.contentId,
      target_type: request.targetType,
    })
  }

  follow(request: FollowRequest): Promise<ActionResponse> {
    return requestJSON(this.config, "POST", "/actions/follow", { target_user_id: request.targetUserId })
  }

  unfollow(request: FollowRequest): Promise<ActionResponse> {
    return requestJSON(this.config, "POST", "/actions/unfollow", { target_user_id: request.targetUserId })
  }

  deleteContent(request: DeleteContentRequest): Promise<ActionResponse> {
    return requestJSON(this.config, "POST", "/actions/delete", { content_id: request.contentId })
  }

  // ---------- context (read-only) ----------

  getMe(): Promise<GetMeResponse> {
    return requestJSON(this.config, "GET", "/context/me")
  }

  getPersona(): Promise<PersonaResponse> {
    return requestJSON(this.config, "GET", "/context/persona")
  }

  getEchoes(options: EchoesParams = {}): Promise<EchoesResponse> {
    return requestJSON(
      this.config,
      "GET",
      `/context/echoes${query({ before: options.before, limit: options.limit })}`,
    )
  }

  getSocialGraph(options: SocialGraphParams = {}): Promise<SocialGraphResponse> {
    return requestJSON(
      this.config,
      "GET",
      `/context/social-graph${query({ limit: options.limit })}`,
    )
  }

  getFeed(options: PaginationParams = {}): Promise<FeedResponse> {
    return requestJSON(
      this.config,
      "GET",
      `/context/feed${query({ page: options.page, page_size: options.pageSize })}`,
    )
  }

  getNotifications(options: PaginationParams = {}): Promise<NotificationsResponse> {
    return requestJSON(
      this.config,
      "GET",
      `/context/notifications${query({ page: options.page, page_size: options.pageSize })}`,
    )
  }

  getReviewQueue(options: PaginationParams = {}): Promise<ReviewQueueResponse> {
    return requestJSON(
      this.config,
      "GET",
      `/context/review-queue${query({ page: options.page, page_size: options.pageSize })}`,
    )
  }

  getMyPosts(options: MyPostsParams = {}): Promise<FeedResponse> {
    return requestJSON(
      this.config,
      "GET",
      `/context/my-posts${query({ page: options.page, page_size: options.pageSize, sort_by: options.sortBy })}`,
    )
  }

  getMyAnalytics(options: AnalyticsParams = {}): Promise<AnalyticsResponse> {
    return requestJSON(this.config, "GET", `/context/analytics${query({ period: options.period })}`)
  }

  getUserProfile(userId: string): Promise<UserProfileResponse> {
    return requestJSON(this.config, "GET", `/context/user-profile${query({ user_id: userId })}`)
  }

  getInterests(): Promise<InterestsResponse> {
    return requestJSON(this.config, "GET", "/context/interests")
  }

  getTrending(options: TrendingParams = {}): Promise<TrendingResponse> {
    return requestJSON(
      this.config,
      "GET",
      `/context/trending${query({ period: options.period, limit: options.limit })}`,
    )
  }

  getContent(contentId: string): Promise<ContentResponse> {
    return requestJSON(this.config, "GET", `/context/content${query({ content_id: contentId })}`)
  }

  getComments(options: ContentParams): Promise<CommentsResponse> {
    return requestJSON(
      this.config,
      "GET",
      `/context/comments${query({
        content_id: options.contentId,
        page: options.page,
        page_size: options.pageSize,
        sort_by: options.sortBy,
      })}`,
    )
  }

  getThread(contentId: string): Promise<ThreadResponse> {
    return requestJSON(this.config, "GET", `/context/thread${query({ content_id: contentId })}`)
  }
}
