import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

// POST /api/stripe/checkout
// Creates a Stripe Checkout Session in "setup" mode — collects a card, attaches it
// to the Stripe Customer, returns the card to /settings/billing?added=1 on success.
// We don't charge anything; this is card-on-file. Later you can flip it to subscription.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const stripe = getStripe();
  // Lazily create the customer if missing
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: { or_user_id: user.id },
    });
    customerId = customer.id;
    await query(`UPDATE or_users SET stripe_customer_id = $1 WHERE id = $2`, [customerId, user.id]);
  }

  // Determine the origin for success/cancel URLs
  const origin =
    req.headers.get('origin') ||
    (process.env.NEXT_PUBLIC_APP_URL || 'https://openroutai.com').replace(/\/$/, '');

  const session = await stripe.checkout.sessions.create({
    mode: 'setup',          // card-on-file, no immediate charge
    customer: customerId,
    payment_method_types: ['card'],
    success_url: `${origin}/settings/billing?added=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/settings/billing?cancelled=1`,
    metadata: { or_user_id: user.id, purpose: 'add_card' },
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 502 });
  }

  // If the request was a form POST (no JS), redirect. If JSON, return the URL.
  const accept = req.headers.get('accept') || '';
  if (accept.includes('application/json')) {
    return NextResponse.json({ url: session.url });
  }
  return NextResponse.redirect(session.url);
}
