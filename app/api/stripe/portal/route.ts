import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/stripe/portal — creates a Stripe Customer Portal session
// (manages cards, subscriptions, invoices, etc.)
// Supports GET so that <a href=...> links work without a form POST
// (CloudFront blocks POST to non-cached paths)
export async function GET(req: NextRequest) {
  const stripe = getStripe();
  const { getSessionUser } = await import('@/lib/auth');
  const user = await getSessionUser();
  if (!user) {
    const origin = req.headers.get('origin') || 'https://openroutai.com';
    return NextResponse.redirect(`${origin}/login`);
  }
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
