import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// POST /api/stripe/link-customer — links the current session user's Stripe
// customer to their account, OR creates a new customer if none exists.
// Useful when Stripe sends a checkout_session.completed for a user whose
// stripe_customer_id was never set in our DB.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const stripe = getStripe();
    let customerId = user.stripe_customer_id;

    // If user already has a customer, still search for OTHER customers
    // with the same email — a previous broken flow may have created
    // additional Stripe customers. Pull invoices from all of them.
    const customerIds: string[] = customerId ? [customerId] : [];

    if (!customerId) {
      // Search for an existing customer with our metadata
      const byMeta = await stripe.customers.search({
        query: `metadata['or_user_id']:'${user.id}'`,
        limit: 5,
      });
      for (const c of byMeta.data) customerIds.push(c.id);

      // Also list customers with the same email (in case prior checkout
      // sessions created customers without metadata)
      const byEmail = await stripe.customers.list({ email: user.email, limit: 10 });
      for (const c of byEmail.data) {
        if (!customerIds.includes(c.id)) customerIds.push(c.id);
      }

      if (customerIds.length === 0) {
        // No existing customer — create one
        const created = await stripe.customers.create({
          email: user.email,
          name: user.name || undefined,
          metadata: { or_user_id: user.id },
        });
        customerIds.push(created.id);
      }

      // Pick the primary customer (the one we'll link to the user)
      customerId = customerIds[0];

      // Backfill metadata on any old customers that lack or_user_id
      for (const id of customerIds) {
        try {
          await stripe.customers.update(id, {
            metadata: { or_user_id: user.id },
          });
        } catch (e) {
          // ignore
        }
      }

      await query(
        `UPDATE or_users SET stripe_customer_id = $1 WHERE id = $2`,
        [customerId, user.id]
      );
    }

    // Re-pull any invoices from Stripe for ALL matching customers and persist them.
    // We may have invoices spread across multiple Stripe customers (orphans
    // from previous broken flows). Pull them all into or_invoices.
    let added = 0;
    let totalSeen = 0;
    for (const custId of customerIds) {
      const invoices = await stripe.invoices.list({ customer: custId, limit: 50 });
      totalSeen += invoices.data.length;
      for (const inv of invoices.data) {
      try {
        const subId = (inv.subscription as string | null) || null;
        const desc = inv.lines?.data?.[0]?.description || null;
        await query(
          `INSERT INTO or_invoices (
            user_id, stripe_invoice_id, stripe_subscription_id,
            amount_due_cents, amount_paid_cents, currency, status,
            description, hosted_invoice_url, invoice_pdf_url,
            period_start, period_end, paid_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (stripe_invoice_id) DO UPDATE SET
            status = EXCLUDED.status,
            amount_due_cents = EXCLUDED.amount_due_cents,
            amount_paid_cents = EXCLUDED.amount_paid_cents,
            hosted_invoice_url = EXCLUDED.hosted_invoice_url,
            invoice_pdf_url = EXCLUDED.invoice_pdf_url,
            paid_at = EXCLUDED.paid_at,
            description = EXCLUDED.description`,
          [
            user.id,
            inv.id,
            subId,
            inv.amount_due,
            inv.amount_paid,
            inv.currency,
            inv.status,
            desc,
            inv.hosted_invoice_url || null,
            inv.invoice_pdf || null,
            inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
            inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
            inv.status === 'paid' && inv.status_transitions?.paid_at
              ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
              : null,
          ]
        );
        added++;
      } catch (e) {
        console.error(`[link-customer] failed to persist invoice ${inv.id}:`, (e as Error).message);
      }
      }
    }

    return NextResponse.json({
      ok: true,
      customer_id: customerId,
      customers_found: customerIds,
      invoices_seen: totalSeen,
      invoices_pulled: added,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
