import { NextRequest, NextResponse } from 'next/server';
import { getStripe, webhookSecret } from '@/lib/stripe';
import { query } from '@/lib/db';

// POST /api/stripe/portal — creates a Stripe Customer Portal session
// (manages cards, subscriptions, invoices, etc.)
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const { getSessionUser } = await import('@/lib/auth');
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!user.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer linked yet' }, { status: 400 });
  }

  const origin =
    req.headers.get('origin') ||
    (process.env.NEXT_PUBLIC_APP_URL || 'https://openroutai.com').replace(/\/$/, '');

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${origin}/settings/billing`,
  });

  return NextResponse.redirect(session.url);
}
