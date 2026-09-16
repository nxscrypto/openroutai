import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { publishableKey } from '@/lib/stripe';

// POST /api/stripe/setup-intent
// Returns: { client_secret, customer_id, publishable_key }
// The frontend uses the client_secret with stripe.confirmCardSetup() to add
// a card on file without leaving the page.
export async function POST(_req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const stripe = getStripe();
    const pk = publishableKey();
    if (!pk) return NextResponse.json({ error: 'Stripe publishable key not configured' }, { status: 500 });

    // Lazily create the Stripe customer if missing.
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

    const intent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session', // allow charging later without the customer being present
    });

    return NextResponse.json({
      client_secret: intent.client_secret,
      customer_id: customerId,
      publishable_key: pk,
    });
  } catch (e) {
    console.error('[setup-intent] error:', (e as Error).message);
    return NextResponse.json({ error: 'Server error', detail: (e as Error).message }, { status: 500 });
  }
}
