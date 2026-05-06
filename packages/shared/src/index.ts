/**
 * Shared types and contracts across Ather services.
 * Keep this package dependency-free; it must build for Node and bundlers.
 */

// ---------- Primitives ----------

export type UUID = string;
export type ISODateString = string;

export type PersonaType = 'personal' | 'professional' | 'anonymous';
export type UserStatus = 'active' | 'suspended' | 'deleted';

// ---------- Identity ----------

export interface PublicUser {
  id: UUID;
  handle: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  personaType: PersonaType;
  createdAt: ISODateString;
}

export interface AuthTokens {
  accessToken: string;
  /** Seconds until accessToken expiry. */
  expiresIn: number;
  refreshToken: string;
  tokenType: 'Bearer';
}

export interface RegisterRequest {
  handle: string;
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  handleOrEmail: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

// ---------- Profile ----------

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

// ---------- API envelopes ----------

export interface CursorPage<T> {
  items: T[];
  nextCursor?: string;
}

/** RFC 7807 problem+json. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  /** Stable error code for clients. */
  code?: string;
}

// ---------- Constants ----------

export const HANDLE_REGEX = /^[a-z0-9_]{3,24}$/;

/** Minimum password length (server may enforce more). */
export const MIN_PASSWORD_LENGTH = 12;
