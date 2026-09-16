import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';

// GET /api/diag/auth — tries getSessionUser, surfaces any error
export async function GET() {
  try {
    const cookieStore = cookies();
    const cookie = cookieStore.get('or_session');
    return NextResponse.json({
      has_cookie: !!cookie,
      cookie_value_length: cookie?.value?.length || 0,
    });
  } catch (e) {
    return NextResponse.json({
      error: (e as Error).message,
      stack: (e as Error).stack,
    }, { status: 500 });
  }
}
