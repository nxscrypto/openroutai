import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/diag/reset-password
// Admin endpoint to reset a user's password.
// Header: x-admin-key must match RESET_PASSWORD_KEY env var.
// Body: { email, new_password }
//
// DELETE THIS ENDPOINT after the user has signed in and changed
// their password via the normal flow.
export async function POST(req: NextRequest) {
  const key = req.headers.get('x-admin-key');
  if (!key || key !== process.env.RESET_PASSWORD_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  }

  const hash = await hashPassword(body.password);
  const r = await query(
    `UPDATE or_users SET password_hash = $1 WHERE email = $2 RETURNING id, email`,
    [hash, body.email]
  );
  if (r.rows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, user: r.rows[0] });
}
