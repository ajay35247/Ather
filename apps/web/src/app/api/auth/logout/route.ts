import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyRefreshToken } from '@/lib/server/jwt';
import { userStore } from '@/lib/server/stores';

const RefreshSchema = z.object({ refreshToken: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = RefreshSchema.parse(body);
    try {
      const claims = verifyRefreshToken(refreshToken);
      await userStore.revokeRefresh(claims.jti);
    } catch {
      // Ignore — logout is best-effort.
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ type: 'about:blank', title: 'Validation failed', status: 400, code: 'validation_failed', detail: err.flatten() }, { status: 400 });
    }
    console.error('POST /api/auth/logout', err);
    return NextResponse.json({ type: 'about:blank', title: 'Internal Server Error', status: 500, code: 'internal_error' }, { status: 500 });
  }
}
