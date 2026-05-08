import { v4 as uuidv4 } from 'uuid';
import type { PersonaType } from '@ather/shared';

// ─── User Store ───────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  handle: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
  status: 'active' | 'suspended' | 'deleted';
}

export interface UserStore {
  create(input: Omit<UserRecord, 'id' | 'createdAt' | 'status'>): Promise<UserRecord>;
  findByHandleOrEmail(handleOrEmail: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  isRefreshRevoked(jti: string): Promise<boolean>;
  revokeRefresh(jti: string): Promise<void>;
}

export class ConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

class InMemoryUserStore implements UserStore {
  private users = new Map<string, UserRecord>();
  private byHandle = new Map<string, string>();
  private byEmail = new Map<string, string>();
  private revoked = new Set<string>();

  async create(input: Omit<UserRecord, 'id' | 'createdAt' | 'status'>): Promise<UserRecord> {
    const handleKey = input.handle.toLowerCase();
    const emailKey = input.email.toLowerCase();
    if (this.byHandle.has(handleKey)) throw new ConflictError('handle already taken');
    if (this.byEmail.has(emailKey)) throw new ConflictError('email already registered');
    const record: UserRecord = {
      id: uuidv4(),
      handle: input.handle,
      email: input.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    this.users.set(record.id, record);
    this.byHandle.set(handleKey, record.id);
    this.byEmail.set(emailKey, record.id);
    return record;
  }

  async findByHandleOrEmail(handleOrEmail: string): Promise<UserRecord | null> {
    const key = handleOrEmail.toLowerCase();
    const id = this.byHandle.get(key) ?? this.byEmail.get(key);
    if (!id) return null;
    return this.users.get(id) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async isRefreshRevoked(jti: string): Promise<boolean> {
    return this.revoked.has(jti);
  }

  async revokeRefresh(jti: string): Promise<void> {
    this.revoked.add(jti);
  }
}

// ─── Profile Store ────────────────────────────────────────────────────────────

export interface ProfileRecord {
  userId: string;
  handle: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  personaType: PersonaType;
  updatedAt: string;
}

export interface ProfileStore {
  upsert(input: Omit<ProfileRecord, 'updatedAt'>): Promise<ProfileRecord>;
  getByUserId(userId: string): Promise<ProfileRecord | null>;
  getByHandle(handle: string): Promise<ProfileRecord | null>;
  update(
    userId: string,
    patch: Partial<Pick<ProfileRecord, 'displayName' | 'bio' | 'avatarUrl'>>
  ): Promise<ProfileRecord | null>;
}

class InMemoryProfileStore implements ProfileStore {
  private byUser = new Map<string, ProfileRecord>();
  private byHandle = new Map<string, string>();

  async upsert(input: Omit<ProfileRecord, 'updatedAt'>): Promise<ProfileRecord> {
    const record: ProfileRecord = { ...input, updatedAt: new Date().toISOString() };
    this.byUser.set(record.userId, record);
    this.byHandle.set(record.handle.toLowerCase(), record.userId);
    return record;
  }

  async getByUserId(userId: string): Promise<ProfileRecord | null> {
    return this.byUser.get(userId) ?? null;
  }

  async getByHandle(handle: string): Promise<ProfileRecord | null> {
    const id = this.byHandle.get(handle.toLowerCase());
    if (!id) return null;
    return this.byUser.get(id) ?? null;
  }

  async update(
    userId: string,
    patch: Partial<Pick<ProfileRecord, 'displayName' | 'bio' | 'avatarUrl'>>
  ): Promise<ProfileRecord | null> {
    const existing = this.byUser.get(userId);
    if (!existing) return null;
    const updated: ProfileRecord = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.byUser.set(userId, updated);
    return updated;
  }
}

// ─── Module-level singletons ──────────────────────────────────────────────────
// Use a global to survive hot-reload in Next.js dev mode.

declare global {
  // eslint-disable-next-line no-var
  var __atherUserStore: UserStore | undefined;
  // eslint-disable-next-line no-var
  var __atherProfileStore: ProfileStore | undefined;
}

export const userStore: UserStore =
  global.__atherUserStore ?? (global.__atherUserStore = new InMemoryUserStore());

export const profileStore: ProfileStore =
  global.__atherProfileStore ?? (global.__atherProfileStore = new InMemoryProfileStore());
