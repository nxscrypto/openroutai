import { NextRequest, NextResponse } from 'next/server';
import { createUser, findUserByEmail, signSessionToken, setSessionCookie } from '@/lib/auth';
import { query } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }
    const user = await createUser(email, password, name || null);

    // Create a Stripe customer immediately so we have the link before the first billing event.
    if (!user.stripe_customer_id && process.env.STRIPE_SECRET) {
      try {
        const stripe = getStripe();
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name || undefined,
          metadata: { or_user_id: user.id },
        });
        await query(`UPDATE or_users SET stripe_customer_id = $1 WHERE id = $2`, [customer.id, user.id]);
        user.stripe_customer_id = customer.id;
      } catch (e) {
        // Don't fail signup if Stripe is down — we'll lazily create the customer
        // when the user first reaches /settings/billing.
        console.error('[signup] stripe customer create failed:', (e as Error).message);
      }
    }

    const token = await signSessionToken(user.id);
    await setSessionCookie(token);

    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
  } catch (e) {
    console.error('[signup] error:', (e as Error).message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
