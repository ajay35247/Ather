import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/server/jwt';
import { profileStore } from '@/lib/server/stores';

const UpdateSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().max(2048).optional(),
});

function getClaimsFromRequest(request: Request) {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    return verifyAccessToken(auth.substring('Bearer '.length));
  } catch {
    return null;
  }
}

async function ensureProfileExists(userId: string, handle: string) {
  const existing = await profileStore.getByUserId(userId);
  if (!existing) {
    await profileStore.upsert({ userId, handle, displayName: handle, personaType: 'personal' });
  }
}

export async function GET(request: Request) {
  try {
    const claims = getClaimsFromRequest(request);
    if (!claims) {
      return NextResponse.json({ status: 401, code: 'unauthorized', detail: 'missing or invalid bearer token' }, { status: 401 });
    }
    let profile = await profileStore.getByUserId(claims.sub);
    if (!profile) {
      profile = await profileStore.upsert({ userId: claims.sub, handle: claims.handle, displayName: claims.handle, personaType: 'personal' });
    }
    return NextResponse.json({ profile });
  } catch (err) {
    console.error('GET /api/profile/me', err);
    return NextResponse.json({ status: 500, code: 'internal_error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const claims = getClaimsFromRequest(request);
    if (!claims) {
      return NextResponse.json({ status: 401, code: 'unauthorized', detail: 'missing or invalid bearer token' }, { status: 401 });
    }
    const body = await request.json();
    const patch = UpdateSchema.parse(body);
    await ensureProfileExists(claims.sub, claims.handle);
    const updated = await profileStore.update(claims.sub, patch);
    return NextResponse.json({ profile: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ status: 400, code: 'validation_failed', detail: err.flatten() }, { status: 400 });
    }
    console.error('PATCH /api/profile/me', err);
    return NextResponse.json({ status: 500, code: 'internal_error' }, { status: 500 });
  }
}
