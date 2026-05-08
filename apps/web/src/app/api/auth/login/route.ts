import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { signAccessToken, signRefreshToken, getAccessTTLSeconds } from '@/lib/server/jwt';
import { verifyPassword } from '@/lib/server/password';
import { userStore } from '@/lib/server/stores';

const LoginSchema = z.object({
  handleOrEmail: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = LoginSchema.parse(body);
    const user = await userStore.findByHandleOrEmail(input.handleOrEmail);
    if (!user || user.status !== 'active') {
      return NextResponse.json({ type: 'about:blank', title: 'Unauthorized', status: 401, code: 'unauthorized', detail: 'invalid credentials' }, { status: 401 });
    }
    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ type: 'about:blank', title: 'Unauthorized', status: 401, code: 'unauthorized', detail: 'invalid credentials' }, { status: 401 });
    }
    const accessToken = signAccessToken({ sub: user.id, handle: user.handle });
    const refreshToken = signRefreshToken({ sub: user.id, jti: uuidv4() });
    return NextResponse.json({
      user: { id: user.id, handle: user.handle, displayName: user.displayName, personaType: 'personal', createdAt: user.createdAt },
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: getAccessTTLSeconds(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ type: 'about:blank', title: 'Validation failed', status: 400, code: 'validation_failed', detail: err.flatten() }, { status: 400 });
    }
    console.error('POST /api/auth/login', err);
    return NextResponse.json({ type: 'about:blank', title: 'Internal Server Error', status: 500, code: 'internal_error' }, { status: 500 });
  }
}
