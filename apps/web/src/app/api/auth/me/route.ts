import { NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/server/jwt';
import { userStore } from '@/lib/server/stores';

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json({ type: 'about:blank', title: 'Unauthorized', status: 401, code: 'unauthorized', detail: 'missing bearer token' }, { status: 401 });
    }
    let claims;
    try {
      claims = verifyAccessToken(auth.substring('Bearer '.length));
    } catch {
      return NextResponse.json({ type: 'about:blank', title: 'Unauthorized', status: 401, code: 'unauthorized', detail: 'invalid access token' }, { status: 401 });
    }
    const user = await userStore.findById(claims.sub);
    if (!user || user.status !== 'active') {
      return NextResponse.json({ type: 'about:blank', title: 'Unauthorized', status: 401, code: 'unauthorized', detail: 'user not active' }, { status: 401 });
    }
    return NextResponse.json({
      user: { id: user.id, handle: user.handle, displayName: user.displayName, personaType: 'personal', createdAt: user.createdAt },
    });
  } catch (err) {
    console.error('GET /api/auth/me', err);
    return NextResponse.json({ type: 'about:blank', title: 'Internal Server Error', status: 500, code: 'internal_error' }, { status: 500 });
  }
}
