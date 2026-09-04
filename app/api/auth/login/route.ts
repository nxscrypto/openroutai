import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, verifyPassword, signSessionToken, setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    const token = await signSessionToken(user.id);
    await setSessionCookie(token);
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
  } catch (e) {
    console.error('[login] error:', (e as Error).message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
