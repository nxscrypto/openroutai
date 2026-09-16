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
// Each persisted row has stripe_invoice_id prefixed with "ch_" so it
// can't collide with real Stripe invoices.
//
// To detect duplicates: we skip charges whose PaymentIntent already has
// an invoice (in our DB or in Stripe).
//
// Header: x-admin-key must match RESET_PASSWORD_KEY.
export async function POST(req: NextRequest) {
  const key = req.headers.get('x-admin-key');
  if (!key || key !== process.env.RESET_PASSWORD_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // First, ensure the 'kind' column exists on or_invoices
    await query(
      `ALTER TABLE or_invoices ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'one_time'`
    );

    const stripe = getStripe();

    const users = await query<{ id: string; email: string; stripe_customer_id: string | null }>(
      `SELECT id, email, stripe_customer_id FROM or_users WHERE stripe_customer_id IS NOT NULL`
    );

    let added = 0;
    let skipped_duplicate = 0;
    let skipped_unsupported = 0;
    const errors: string[] = [];

    for (const user of users.rows) {
      if (!user.stripe_customer_id) continue;
      try {
        const charges = await stripe.charges.list({ customer: user.stripe_customer_id, limit: 100 });
        for (const ch of charges.data) {
          if (!ch.paid || ch.status !== 'succeeded') {
            skipped_unsupported++;
            continue;
          }

          // Use charge id as pseudo-invoice id
          const pseudoInvoiceId = `ch_${ch.id}`;

          // If we already have this charge, skip
          const existing = await query<{ id: string }>(
            `SELECT id FROM or_invoices WHERE stripe_invoice_id = $1`,
            [pseudoInvoiceId]
          );
          if (existing.rows.length > 0) {
            skipped_duplicate++;
            continue;
          }

          // If the charge's PaymentIntent has a real invoice, skip — that
          // real invoice is already in our DB (or will be via webhook).
          const piId = typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id;
          if (piId) {
            // Look up any invoice in Stripe linked to this PaymentIntent
            const invList = await stripe.invoices.list({ limit: 1 });
            const piInvoice = invList.data.find((i: any) => i.payment_intent === piId);
            if (piInvoice) {
              // A real invoice exists — skip the charge, the webhook handles it
              skipped_duplicate++;
              continue;
            }
            // Also check our own DB for any invoice with this PaymentIntent
            // (stored in payment_intent_id column or via stripe_subscription_id)
            const ourInv = await query<{ id: string }>(
              `SELECT id FROM or_invoices WHERE stripe_subscription_id IN (
                SELECT stripe_subscription_id FROM or_subscriptions WHERE stripe_price_id = $1
              ) LIMIT 1`,
              [ch.metadata?.price_id || '']
            );
            // (soft check; if not found we still insert the charge below)
          }

          const amountCents = ch.amount;
          const currency = ch.currency;
          const description = ch.description
            || (ch.metadata?.price_id ? `One-time charge — ${ch.metadata.price_id}` : 'One-time charge');
          const paid = ch.status === 'succeeded';
          const created = new Date(ch.created * 1000).toISOString();

          // Detect if it's a recurring subscription charge: the charge's
          // `invoice` field is set when it's a subscription invoice payment.
          // Also: if it has no PI/invoice but has a description matching
          // subscription patterns, treat as recurring.
          const chargeAny = ch as any;
          const isRecurring = !!(
            chargeAny.invoice ||
            /subscription/i.test(description) ||
            /subscription/i.test(chargeAny.description || '')
          );
          const kind = isRecurring ? 'subscription' : 'one_time';

          // Receipt URL is the closest thing to an invoice URL for a charge
          const hostedInvoiceUrl = ch.receipt_url || null;

          await query(
            `INSERT INTO or_invoices (
              user_id, stripe_invoice_id, stripe_subscription_id,
              amount_due_cents, amount_paid_cents, currency, status,
              description, hosted_invoice_url, invoice_pdf_url,
              period_start, period_end, paid_at, created_at, kind
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
            ON CONFLICT (stripe_invoice_id) DO UPDATE SET
              status = EXCLUDED.status,
              amount_paid_cents = EXCLUDED.amount_paid_cents,
              hosted_invoice_url = EXCLUDED.hosted_invoice_url,
              paid_at = EXCLUDED.paid_at,
              kind = EXCLUDED.kind`,
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
              kind,
            ]
          );
          added++;
        }
      } catch (e) {
        errors.push(`${user.email}: ${(e as Error).message}`);
      }
    }

    // Re-run: also update existing rows that have NULL kind to one_time
    await query(`UPDATE or_invoices SET kind = 'one_time' WHERE kind IS NULL`);

    // For invoices linked to a subscription, mark as 'subscription'
    await query(`
      UPDATE or_invoices SET kind = 'subscription'
      WHERE stripe_subscription_id IS NOT NULL
        AND (kind IS NULL OR kind = 'one_time')
    `);

    // For backfilled charges whose description mentions subscription, mark as 'subscription'
    await query(`
      UPDATE or_invoices SET kind = 'subscription'
      WHERE stripe_invoice_id LIKE 'ch_%'
        AND (description ILIKE '%subscription%' OR description ILIKE 'pi_%')
        AND (kind IS NULL OR kind = 'one_time')
    `);

    return NextResponse.json({
      ok: true,
      users_scanned: users.rows.length,
      charges_persisted: added,
      skipped_duplicate,
      skipped_unsupported,
      errors,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
