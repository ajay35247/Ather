import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { signAccessToken, signRefreshToken, verifyRefreshToken, getAccessTTLSeconds } from '@/lib/server/jwt';
import { userStore } from '@/lib/server/stores';

const RefreshSchema = z.object({ refreshToken: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = RefreshSchema.parse(body);
    let claims;
    try {
      claims = verifyRefreshToken(refreshToken);
    } catch {
      return NextResponse.json({ type: 'about:blank', title: 'Unauthorized', status: 401, code: 'unauthorized', detail: 'invalid refresh token' }, { status: 401 });
    }
    if (await userStore.isRefreshRevoked(claims.jti)) {
      return NextResponse.json({ type: 'about:blank', title: 'Unauthorized', status: 401, code: 'unauthorized', detail: 'refresh token revoked' }, { status: 401 });
    }
    const user = await userStore.findById(claims.sub);
    if (!user || user.status !== 'active') {
      return NextResponse.json({ type: 'about:blank', title: 'Unauthorized', status: 401, code: 'unauthorized', detail: 'user not active' }, { status: 401 });
    }
    await userStore.revokeRefresh(claims.jti);
    const accessToken = signAccessToken({ sub: user.id, handle: user.handle });
    const newRefreshToken = signRefreshToken({ sub: user.id, jti: uuidv4() });
    return NextResponse.json({ accessToken, refreshToken: newRefreshToken, tokenType: 'Bearer', expiresIn: getAccessTTLSeconds() });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ type: 'about:blank', title: 'Validation failed', status: 400, code: 'validation_failed', detail: err.flatten() }, { status: 400 });
    }
    console.error('POST /api/auth/refresh', err);
    return NextResponse.json({ type: 'about:blank', title: 'Internal Server Error', status: 500, code: 'internal_error' }, { status: 500 });
  }
}
