import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

// POST /api/stripe/set-default-card
// body: { payment_method_id: "pm_..." }
// Sets the given payment method as the default for the Stripe Customer
// (so future invoices charge it) AND in our local DB (is_default flag).
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!user.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer linked yet' }, { status: 400 });
  }

  let body: { payment_method_id?: string };
  try { body = await req.json(); } catch { body = {}; }
  const pmId = body.payment_method_id;
  if (!pmId) return NextResponse.json({ error: 'payment_method_id required' }, { status: 400 });

  try {
    const stripe = getStripe();

    // Verify the payment method belongs to this customer
    const pm = await stripe.paymentMethods.retrieve(pmId);
    const pmCustomer = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id;
    if (pmCustomer !== user.stripe_customer_id) {
      return NextResponse.json({ error: 'Payment method does not belong to this customer' }, { status: 403 });
    }

    // Set as default on Stripe side
    await stripe.customers.update(user.stripe_customer_id, {
      invoice_settings: { default_payment_method: pmId },
    });

    // Update our DB — clear all is_default flags, set this one
    await query(
      `UPDATE or_payment_methods SET is_default = false WHERE user_id = $1`,
      [user.id]
    );
    await query(
      `UPDATE or_payment_methods SET is_default = true
       WHERE user_id = $1 AND stripe_payment_method_id = $2`,
      [user.id, pmId]
    );

    return NextResponse.json({ ok: true, default_payment_method: pmId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
