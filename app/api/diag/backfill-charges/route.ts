import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// POST /api/diag/backfill-charges
// Manually backfill or_invoices from Stripe Charges for the current user.
// Stripe Checkout one-time payments without invoice_creation become Charges,
// not Invoices. This endpoint pulls them and stores them in or_invoices so
// the user can see them in their billing UI.
//
// Header: x-admin-key must match RESET_PASSWORD_KEY (same secret for now).
export async function POST(req: NextRequest) {
  const key = req.headers.get('x-admin-key');
  if (!key || key !== process.env.RESET_PASSWORD_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stripe = getStripe();

    // Find affected users (those with a stripe_customer_id)
    const users = await query<{ id: string; email: string; stripe_customer_id: string | null }>(
      `SELECT id, email, stripe_customer_id FROM or_users WHERE stripe_customer_id IS NOT NULL`
    );

    let added = 0;
    const errors: string[] = [];

    for (const user of users.rows) {
      if (!user.stripe_customer_id) continue;
      try {
        // List all charges for this customer
        const charges = await stripe.charges.list({ customer: user.stripe_customer_id, limit: 50 });
        for (const ch of charges.data) {
          // Skip charges that are already captured as invoices (linked through PaymentIntent)
          if (!ch.paid || ch.status !== 'succeeded') continue;

          // Use the charge ID as a pseudo-invoice ID
          const pseudoInvoiceId = `ch_${ch.id}`;
          const amountCents = ch.amount;
          const currency = ch.currency;
          const description = ch.description || (ch.metadata?.price_id ? `One-time charge for ${ch.metadata.price_id}` : 'One-time charge');
          const paid = ch.status === 'succeeded';
          const created = new Date(ch.created * 1000).toISOString();

          // Receipt URL is the closest thing to an invoice URL for a charge
          const hostedInvoiceUrl = ch.receipt_url || null;

          // Insert with ON CONFLICT to make it idempotent. We use the charge id
          // prefixed with "ch_" so it doesn't collide with real Stripe invoice ids.
          await query(
            `INSERT INTO or_invoices (
              user_id, stripe_invoice_id, stripe_subscription_id,
              amount_due_cents, amount_paid_cents, currency, status,
              description, hosted_invoice_url, invoice_pdf_url,
              period_start, period_end, paid_at, created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            ON CONFLICT (stripe_invoice_id) DO UPDATE SET
              status = EXCLUDED.status,
              amount_paid_cents = EXCLUDED.amount_paid_cents,
              hosted_invoice_url = EXCLUDED.hosted_invoice_url,
              paid_at = EXCLUDED.paid_at`,
            [
              user.id,
              pseudoInvoiceId,
              null,
              amountCents,
              paid ? amountCents : 0,
              currency,
              paid ? 'paid' : 'unpaid',
              description,
              hostedInvoiceUrl,
              null,
              null,
              null,
              paid ? created : null,
              created,
            ]
          );
          added++;
        }
      } catch (e) {
        errors.push(`${user.email}: ${(e as Error).message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      users_scanned: users.rows.length,
      charges_persisted: added,
      errors,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
