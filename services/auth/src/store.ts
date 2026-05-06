import { v4 as uuidv4 } from 'uuid';

/**
 * Phase 0: in-memory user store. Phase 1 replaces with Postgres.
 * The interface is intentionally narrow so swapping is mechanical.
 */

export interface UserRecord {
  id: string;
  handle: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
  status: 'active' | 'suspended' | 'deleted';
}

export interface RevokedRefresh {
  jti: string;
  revokedAt: string;
}

export interface UserStore {
  create(input: Omit<UserRecord, 'id' | 'createdAt' | 'status'>): Promise<UserRecord>;
  findByHandleOrEmail(handleOrEmail: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  isRefreshRevoked(jti: string): Promise<boolean>;
  revokeRefresh(jti: string): Promise<void>;
}

export class InMemoryUserStore implements UserStore {
  private users = new Map<string, UserRecord>();
  private byHandle = new Map<string, string>();
  private byEmail = new Map<string, string>();
  private revoked = new Set<string>();

  async create(
    input: Omit<UserRecord, 'id' | 'createdAt' | 'status'>
  ): Promise<UserRecord> {
    const handleKey = input.handle.toLowerCase();
    const emailKey = input.email.toLowerCase();
    if (this.byHandle.has(handleKey)) {
      throw new ConflictError('handle already taken');
    }
    if (this.byEmail.has(emailKey)) {
      throw new ConflictError('email already registered');
    }
    const record: UserRecord = {
      id: uuidv4(),
      handle: input.handle,
      email: input.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      createdAt: new Date().toISOString(),
      status: 'active'
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

export class ConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
