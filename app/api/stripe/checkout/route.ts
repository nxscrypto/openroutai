import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

// POST /api/stripe/checkout
// body: { price_id?: string } — if provided, create a subscription checkout session;
// otherwise create a setup-mode session to add a card-on-file.
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const stripe = getStripe();

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

    let body: { price_id?: string; mode?: 'subscription' | 'setup' | 'payment' } = {};
    try { body = await req.json(); } catch {}
    // Allow form-encoded too (the Add card button submits as a form)
    if (!body.price_id && req.headers.get('content-type')?.includes('form')) {
      const form = await req.formData();
      body.price_id = (form.get('price_id') as string) || undefined;
      body.mode = (form.get('mode') as 'subscription' | 'setup') || undefined;
    }

    const origin =
      req.headers.get('origin') ||
      (process.env.NEXT_PUBLIC_APP_URL || 'https://openroutai.com').replace(/\/$/, '');

    // Determine checkout mode
    let price: { id: string; recurring: unknown; unit_amount: number | null } | null = null;
    if (body.price_id) {
      const p = await stripe.prices.retrieve(body.price_id);
      price = { id: p.id, recurring: p.recurring, unit_amount: p.unit_amount };
    }

    let session;
    if (price && price.recurring) {
      // Subscription checkout
      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: price.id, quantity: 1 }],
        payment_method_types: ['card'],
        success_url: `${origin}/settings/billing?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/settings/billing?cancelled=1`,
        metadata: { or_user_id: user.id, price_id: price.id },
      });
    } else if (price && !price.recurring && price.unit_amount !== null) {
      // One-time payment
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        line_items: [{ price: price.id, quantity: 1 }],
        payment_method_types: ['card'],
        success_url: `${origin}/settings/billing?paid=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/settings/billing?cancelled=1`,
        metadata: { or_user_id: user.id, price_id: price.id },
      });
    } else {
      // Setup mode — card on file
      session = await stripe.checkout.sessions.create({
        mode: 'setup',
        customer: customerId,
        payment_method_types: ['card'],
        success_url: `${origin}/settings/billing?added=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/settings/billing?cancelled=1`,
        metadata: { or_user_id: user.id, purpose: 'add_card' },
      });
    }

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 502 });
    }

    const accept = req.headers.get('accept') || '';
    if (accept.includes('application/json')) {
      return NextResponse.json({ url: session.url });
    }
    return NextResponse.redirect(session.url);
  } catch (e) {
    console.error('[checkout] error:', (e as Error).message, (e as Error).stack);
    const accept = req.headers.get('accept') || '';
    if (accept.includes('application/json')) {
      return NextResponse.json({ error: 'Server error', detail: (e as Error).message }, { status: 500 });
    }
    // For browser form posts, redirect back to billing with an error
    const url = new URL('/settings/billing', req.url);
    url.searchParams.set('error', encodeURIComponent((e as Error).message));
    return NextResponse.redirect(url);
  }
}
