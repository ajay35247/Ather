// ─── User & Identity ─────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatar?: string;
  bio?: string;
  website?: string;
  location?: string;
  isVerified: boolean;
  isPrivate: boolean;
  reputation: number;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  displayName: string;
  email: string;
  password: string;
}

// ─── Posts & Feed ─────────────────────────────────────────────────────────────

export type PostType = 'text' | 'image' | 'video' | 'reel' | 'story' | 'poll';

export interface Post {
  id: string;
  author: User;
  type: PostType;
  content: string;
  mediaUrls: string[];
  tags: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  visibility: 'public' | 'friends' | 'private';
  createdAt: string;
}

export interface Comment {
  id: string;
  author: User;
  content: string;
  likesCount: number;
  isLiked: boolean;
  replies?: Comment[];
  createdAt: string;
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file';

export interface Message {
  id: string;
  conversationId: string;
  sender: User;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  isRead: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'channel';
  name?: string;
  avatar?: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

// ─── Communities ──────────────────────────────────────────────────────────────

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatar?: string;
  banner?: string;
  category: string;
  membersCount: number;
  postsCount: number;
  isPrivate: boolean;
  isMember: boolean;
  createdAt: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'mention'
  | 'message'
  | 'community_invite'
  | 'live_start';

export interface Notification {
  id: string;
  type: NotificationType;
  actor: User;
  targetId?: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
