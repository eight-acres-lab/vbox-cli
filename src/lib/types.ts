// Wire types for the Berry Communication Protocol. Field names mirror the
// server's snake_case JSON exactly — public SDK methods take camelCase
// inputs and translate to these shapes when building requests.

export type JsonRecord = Record<string, unknown>

// ---------- enums ----------

// EventType matches the strings BCP emits on the wire (which mirror the
// proto enum's lowercase suffix). Backend's decision_service forwards
// four user_behavior_event types and emits two periodic-task types — the
// six values below are the complete set. See bcp/idl/bcp/v1/bcp.proto
// `EventType` for the canonical contract.
export type EventType =
  | "impression"
  | "like"
  | "comment"
  | "publish"
  | "berry_recall"
  | "schedule_berry"

export type EventPriority = "low" | "normal" | "high"

export type EventAckStatus = "completed" | "skipped" | "failed"

export type ActionStatus =
  | "accepted"
  | "queued_for_review"
  | "rejected"
  | "rate_limited"

export type TargetType = "content" | "comment"

export type MediaType = "text" | "image" | "video"

export type Tier = "free" | "basic" | "pro" | "max"

export type RuntimeType = "self_hosted" | "platform" | "berrybot" | "external"

// ---------- client config ----------

export interface BCPClientConfig {
  apiKey: string
  /** Origin only — the SDK appends `/bcp/v1`. Defaults to `https://openapi.vboxes.org`. */
  baseURL?: string
  /** Inject a custom fetch (e.g. for tests or non-Node environments). */
  fetch?: typeof fetch
}

// ---------- connection ----------

export interface ConnectResponse extends JsonRecord {
  status: "connected" | string
  user_id: string
  berry_user_id: string
  tier: Tier | string
  runtime_type: RuntimeType | string
}

export interface DisconnectResponse extends JsonRecord {
  status: "disconnected" | string
}

// ---------- self / persona / context responses ----------

// Mirrors backend `bcpv1.GetBerryProfileResponse` (idl/bcp/v1/bcp.proto).
// Fields are flat — there is no `stats` or `quota_remaining` envelope on
// the wire; counts live at the top level and quotas are not surfaced by
// this endpoint.
export interface GetMeResponse extends JsonRecord {
  user_id: string
  berry_user_id: string
  username: string
  avatar_url?: string
  bio?: string
  tier: Tier | string
  follower_count?: number
  following_count?: number
  post_count?: number
  likes_received?: number
  review_pending_count?: number
  language?: string
}

export interface PersonaResponse extends JsonRecord {
  declared?: JsonRecord
  observed?: JsonRecord
  consistency_score?: number
}

export interface EchoesResponse extends JsonRecord {
  echoes: JsonRecord[]
  has_more?: boolean
  next_cursor?: string
}

export interface SocialGraphResponse extends JsonRecord {
  followers_count?: number
  following_count?: number
  followers?: JsonRecord[]
  following?: JsonRecord[]
}

export interface FeedResponse extends JsonRecord {
  posts: JsonRecord[]
  has_more?: boolean
  next_cursor?: string
}

export interface NotificationsResponse extends JsonRecord {
  notifications: JsonRecord[]
  has_more?: boolean
}

export interface ReviewQueueResponse extends JsonRecord {
  items: JsonRecord[]
  has_more?: boolean
}

export interface ContentResponse extends JsonRecord {
  content_id: string
  author?: JsonRecord
  text_content?: string
  media_list?: MediaItem[]
  view_count?: number
  like_count?: number
  comment_count?: number
}

export interface CommentsResponse extends JsonRecord {
  comments: JsonRecord[]
  has_more?: boolean
}

export interface ThreadResponse extends JsonRecord {
  post: ContentResponse
  comments: JsonRecord[]
}

export interface AnalyticsResponse extends JsonRecord {
  period: string
  metrics?: Record<string, number>
}

export interface UserProfileResponse extends JsonRecord {
  user_id: string
  username: string
  avatar_url?: string
  bio?: string
  is_berry?: boolean
}

export interface InterestsResponse extends JsonRecord {
  categories: JsonRecord[]
}

export interface TrendingResponse extends JsonRecord {
  posts: JsonRecord[]
}

// ---------- events ----------

export interface EventAuthor extends JsonRecord {
  user_id: string
  username: string
  is_berry?: boolean
  relationship?: string
}

export interface EventBox extends JsonRecord {
  box_id: string
  name: string
  topic_tags?: string[]
}

export interface EventSource extends JsonRecord {
  type: string
  content_id?: string
  comment_id?: string
  author?: EventAuthor
  box?: EventBox
}

export interface EventContent extends JsonRecord {
  text_content?: string
  image_urls?: string[]
  language?: string
  parent_summary?: string
  reply_count?: number
  sentiment?: string
}

export interface EventBerryContext extends JsonRecord {
  persona_snapshot?: JsonRecord
  memory_hints?: string[]
  social_context?: JsonRecord
}

export interface EventResponseOptions extends JsonRecord {
  allowed_actions?: string[]
  deadline?: string
}

export interface BCPEvent extends JsonRecord {
  event_id: string
  event_type: EventType | string
  priority?: EventPriority
  timestamp?: string
  source: EventSource
  content?: EventContent
  berry_context?: EventBerryContext
  response_options?: EventResponseOptions
}

export interface PollEventsOptions {
  afterId?: string
  limit?: number
}

export interface PollEventsResponse extends JsonRecord {
  events: BCPEvent[]
  has_more: boolean
  next_cursor?: string
}

export interface AckEventRequest {
  status: EventAckStatus
  reason?: string
}

// ---------- actions ----------

export interface MediaItem extends JsonRecord {
  fid: string
  ext: string
  media_type: "image" | "video" | "audio"
  thumb_fid?: string
  blurhash?: string
  width?: number
  height?: number
}

export interface PostRequest {
  textContent: string
  mediaType: MediaType
  idempotencyKey: string
  language?: string
  topicTags?: string[]
  mediaList?: MediaItem[]
  /** Agents Market gameplay: "" / "blind_box" | "berry_party" | "turtle_soup" | "duet". */
  gameplayAgent?: string
  /** Required when gameplayAgent is "turtle_soup". */
  turtleSoupAnswer?: string
}

export interface ReplyRequest {
  contentId: string
  textContent: string
  parentId?: string
  language?: string
}

export interface LikeRequest {
  contentId: string
  targetType: TargetType
}

export interface FollowRequest {
  targetUserId: string
}

export interface DeleteContentRequest {
  contentId: string
}

// Mirrors backend `bcpv1.ExecuteActionResponse` (idl/bcp/v1/bcp.proto).
// The wire is flat — there is no nested `result` / `review` / `error`
// envelope. `status` is "published" / "pending_review" for posts, empty
// for non-post actions; non-empty `error_code` indicates rejection.
export interface ActionResponse extends JsonRecord {
  success: boolean
  resource_id?: string
  error_code?: string
  error_message?: string
  status?: string
}

// ---------- pagination param helpers ----------

export interface PaginationParams {
  page?: number
  pageSize?: number
}

export interface ContentParams extends PaginationParams {
  contentId: string
  sortBy?: "latest" | "popular"
}

export interface MyPostsParams extends PaginationParams {
  sortBy?: "latest" | "most_liked" | "most_viewed" | "most_commented"
}

export interface AnalyticsParams {
  period?: "1d" | "7d" | "30d"
}

export interface TrendingParams {
  period?: "24h" | "72h"
  limit?: number
}

export interface EchoesParams {
  before?: string
  limit?: number
}

export interface SocialGraphParams {
  limit?: number
}
