import { NextResponse } from 'next/server';
import { profileStore } from '@/lib/server/stores';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle: rawHandle } = await params;
    const handle = String(rawHandle ?? '').trim();
    if (!handle) {
      return NextResponse.json({ status: 400, code: 'bad_request' }, { status: 400 });
    }
    const profile = await profileStore.getByHandle(handle);
    if (!profile) {
      return NextResponse.json({ status: 404, code: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ profile });
  } catch (err) {
    console.error('GET /api/profile/by-handle/[handle]', err);
    return NextResponse.json({ status: 500, code: 'internal_error' }, { status: 500 });
  }
}
