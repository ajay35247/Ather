import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { HANDLE_REGEX, MIN_PASSWORD_LENGTH } from '@ather/shared';
import { signAccessToken, signRefreshToken, getAccessTTLSeconds } from '@/lib/server/jwt';
import { hashPassword } from '@/lib/server/password';
import { userStore, ConflictError } from '@/lib/server/stores';

const RegisterSchema = z.object({
  handle: z.string().regex(HANDLE_REGEX, 'invalid handle'),
  email: z.string().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  displayName: z.string().min(1).max(80),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = RegisterSchema.parse(body);
    const passwordHash = await hashPassword(input.password);
    const user = await userStore.create({
      handle: input.handle,
      email: input.email,
      displayName: input.displayName,
      passwordHash,
    });
    const accessToken = signAccessToken({ sub: user.id, handle: user.handle });
    const refreshToken = signRefreshToken({ sub: user.id, jti: uuidv4() });
    return NextResponse.json(
      {
        user: { id: user.id, handle: user.handle, displayName: user.displayName, personaType: 'personal', createdAt: user.createdAt },
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: getAccessTTLSeconds(),
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ type: 'about:blank', title: 'Validation failed', status: 400, code: 'validation_failed', detail: err.flatten() }, { status: 400 });
    }
    if (err instanceof ConflictError) {
      return NextResponse.json({ type: 'about:blank', title: 'Conflict', status: 409, code: 'conflict', detail: err.message }, { status: 409 });
    }
    console.error('POST /api/auth/register', err);
    return NextResponse.json({ type: 'about:blank', title: 'Internal Server Error', status: 500, code: 'internal_error' }, { status: 500 });
  }
}
