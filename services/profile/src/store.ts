import type { PersonaType } from '@ather/shared';

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

export class InMemoryProfileStore implements ProfileStore {
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
    const updated: ProfileRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    this.byUser.set(userId, updated);
    return updated;
  }
}
