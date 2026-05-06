# API Design — Phase 1

All list endpoints use **opaque cursor pagination** (`?cursor=…&limit=…`).
All mutations are **idempotent** via `Idempotency-Key` header.
All responses are JSON unless noted; errors follow [RFC 7807 problem+json](https://www.rfc-editor.org/rfc/rfc7807).

## Auth (REST)

| Method | Path                     | Description                          |
|--------|--------------------------|--------------------------------------|
| POST   | `/auth/register`         | Create account (handle/email/password) |
| POST   | `/auth/login`            | Issue access + refresh tokens        |
| POST   | `/auth/refresh`          | Rotate refresh, issue new access     |
| POST   | `/auth/logout`           | Revoke refresh token                 |
| POST   | `/auth/2fa/enroll`       | Begin TOTP / WebAuthn enrollment     |
| POST   | `/auth/2fa/verify`       | Complete enrollment / step-up        |
| GET    | `/auth/me`               | Current user (from access token)     |
| GET    | `/oauth/authorize`       | OAuth2 authorize (PKCE required)     |
| POST   | `/oauth/token`           | OAuth2 token endpoint                |

## Profile (GraphQL)

```graphql
type Query {
  me: User!
  user(handle: String!): User
}

type Mutation {
  updateProfile(input: UpdateProfileInput!): User!
  switchPersona(personaId: ID!): User!
}
```

## Social Graph (GraphQL)

```graphql
type Mutation {
  follow(userId: ID!): FollowEdge!
  unfollow(userId: ID!): Boolean!
  block(userId: ID!): Boolean!
}

type Query {
  followers(userId: ID!, cursor: String, limit: Int): UserConnection!
  following(userId: ID!, cursor: String, limit: Int): UserConnection!
}
```

## Posts & Reactions (GraphQL)

```graphql
type Mutation {
  createPost(input: CreatePostInput!): Post!
  deletePost(id: ID!): Boolean!
  reactToPost(postId: ID!, kind: ReactionKind!): Reaction!
  comment(postId: ID!, parentId: ID, body: String!): Comment!
}

type Query {
  post(id: ID!): Post
  userPosts(userId: ID!, cursor: String, limit: Int): PostConnection!
}
```

## Feed (GraphQL)

```graphql
enum FeedMode { FOR_YOU FOLLOWING CHRONOLOGICAL }

type Query {
  homeFeed(mode: FeedMode = FOR_YOU, cursor: String, limit: Int): FeedConnection!
}

type Mutation {
  reportContent(targetId: ID!, reason: ReportReason!, details: String): Boolean!
}
```

## Media (REST)

| Method | Path                    | Description                                                  |
|--------|-------------------------|--------------------------------------------------------------|
| POST   | `/media/upload-url`     | Returns S3-style pre-signed PUT URL + media id               |
| POST   | `/media/{id}/finalize`  | Client tells server upload completed; transcode is enqueued  |
| GET    | `/media/{id}`           | Returns variants (HLS manifest, thumbnails, dims, duration)  |

## Messaging (WebSocket + REST)

WS endpoint: `/chat`. Client → server events:
- `message.send { conversationId, ciphertext, mediaId? }`
- `typing { conversationId, state }`

Server → client events:
- `message.delivered { id, conversationId }`
- `message.read { id, by }`
- `presence { userId, state }`

REST:

| Method | Path                                       |
|--------|--------------------------------------------|
| GET    | `/conversations`                           |
| GET    | `/conversations/{id}/messages?cursor=`     |
| POST   | `/conversations` (create dm/group)         |

## Notifications

- `WS /notifications` push-stream.
- `GET /notifications` (paginated).
- `PATCH /notifications/{id}/read`.

## Search

- `GET /search?q=&type=user|post|community&cursor=&limit=`.

## AI Assistant

| Method | Path                       | Description                       |
|--------|----------------------------|-----------------------------------|
| POST   | `/ai/chat`                 | Streamed (SSE) chat with assistant |
| POST   | `/ai/summarize`            | Summarize a thread, video, or feed |
| POST   | `/ai/suggest-reply`        | Quick replies for a message thread |
| POST   | `/ai/generate-caption`     | Suggest caption for a post draft   |

All AI endpoints are **per-user quota gated** and require an explicit user-level opt-in stored on the profile.

## Versioning

- REST: `Accept: application/vnd.ather.v1+json`. Breaking changes ship as `v2` alongside `v1`.
- GraphQL: schema is additive only; deprecations marked with `@deprecated(reason:)`.

## Rate Limits

- Per-token + per-IP buckets in Redis (token bucket).
- Different buckets for read vs write vs AI endpoints.
- 429 responses include `Retry-After`.
