import { NextRequest, NextResponse } from 'next/server';
import { getStripe, webhookSecret } from '@/lib/stripe';
import { query } from '@/lib/db';
import type Stripe from 'stripe';

// POST /api/stripe/webhook
// IMPORTANT: We verify the Stripe-Signature header against STRIPE_WEBHOOK_SECRET.
// Stripe gives us a unique event ID per event — we record it in or_stripe_events
// for idempotency, so a retry from Stripe won't double-apply.
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = webhookSecret();
  if (!secret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'webhook not configured' }, { status: 500 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'missing stripe-signature header' }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    console.error('[webhook] signature verification failed:', (e as Error).message);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  // Idempotency: skip if we've already processed this event id
  const existing = await query<{ id: string }>(
    `SELECT id FROM or_stripe_events WHERE id = $1`, [event.id]
  );
  if (existing.rows.length > 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  // Record immediately so concurrent deliveries don't both process
  await query(
    `INSERT INTO or_stripe_events (id, type, payload, processed) VALUES ($1, $2, $3, false)
     ON CONFLICT (id) DO NOTHING`,
    [event.id, event.type, JSON.stringify(event)]
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.or_user_id;
        if (!userId) break;
        // Setup-mode checkout: customer added a payment method. Persist it.
        if (session.mode === 'setup' && session.setup_intent) {
          const setupIntent = await stripe.setupIntents.retrieve(
            typeof session.setup_intent === 'string' ? session.setup_intent : session.setup_intent.id
          );
          const pmId = typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method?.id;
          if (pmId) {
            const pm = await stripe.paymentMethods.retrieve(pmId);
            if (pm.card) {
              await query(
                `INSERT INTO or_payment_methods
                   (user_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default)
                 VALUES ($1, $2, $3, $4, $5, $6, true)
                 ON CONFLICT (stripe_payment_method_id) DO UPDATE
                   SET is_default = true`,
                [
                  userId,
                  pm.id,
                  pm.card.brand,
                  pm.card.last4,
                  pm.card.exp_month,
                  pm.card.exp_year,
                ]
              );
              // Make this the default on the customer side too
              if (typeof session.customer === 'string') {
                await stripe.customers.update(session.customer, {
                  invoice_settings: { default_payment_method: pm.id },
                });
              }
            }
          }
        }
        break;
      }

      case 'payment_method.attached': {
        const pm = event.data.object as Stripe.PaymentMethod;
        const customerId = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id;
        if (!customerId) break;
        const users = await query<{ id: string }>(
          `SELECT id FROM or_users WHERE stripe_customer_id = $1 LIMIT 1`, [customerId]
        );
        const userId = users.rows[0]?.id;
        if (userId && pm.card) {
          await query(
            `INSERT INTO or_payment_methods
               (user_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default)
             VALUES ($1, $2, $3, $4, $5, $6, true)
             ON CONFLICT (stripe_payment_method_id) DO UPDATE
               SET is_default = true`,
            [userId, pm.id, pm.card.brand, pm.card.last4, pm.card.exp_month, pm.card.exp_year]
          );
        }
        break;
      }

      case 'payment_method.detached': {
        const pm = event.data.object as Stripe.PaymentMethod;
        await query(`DELETE FROM or_payment_methods WHERE stripe_payment_method_id = $1`, [pm.id]);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const users = await query<{ id: string }>(
          `SELECT id FROM or_users WHERE stripe_customer_id = $1 LIMIT 1`, [customerId]
        );
        const userId = users.rows[0]?.id;
        if (userId) {
          const priceId = sub.items.data[0]?.price.id || null;
          await query(
            `INSERT INTO or_subscriptions
               (user_id, stripe_subscription_id, stripe_price_id, status,
                current_period_start, current_period_end, cancel_at_period_end, canceled_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (stripe_subscription_id) DO UPDATE SET
               stripe_price_id = EXCLUDED.stripe_price_id,
               status = EXCLUDED.status,
               current_period_start = EXCLUDED.current_period_start,
               current_period_end = EXCLUDED.current_period_end,
               cancel_at_period_end = EXCLUDED.cancel_at_period_end,
               canceled_at = EXCLUDED.canceled_at,
               updated_at = now()`,
            [
              userId,
              sub.id,
              priceId,
              sub.status,
              new Date(sub.current_period_start * 1000).toISOString(),
              new Date(sub.current_period_end * 1000).toISOString(),
              sub.cancel_at_period_end,
              sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
            ]
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await query(
          `UPDATE or_subscriptions SET status = 'canceled', canceled_at = now(), updated_at = now()
           WHERE stripe_subscription_id = $1`,
          [sub.id]
        );
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.finalized':
      case 'invoice.created': {
        const inv = event.data.object as Stripe.Invoice;
        // Find user via stripe_customer_id
        let userId: string | null = null;
        if (inv.customer) {
          const r = await query<{ id: string }>(
            `SELECT id FROM or_users WHERE stripe_customer_id = $1`,
            [inv.customer]
          );
          if (r.rows[0]) userId = r.rows[0].id;
        }
        if (!userId) {
          console.warn(`[webhook] invoice ${inv.id}: user not found for customer ${inv.customer}`);
          break;
        }
        const subscriptionId = (inv.subscription as string | null) || null;
        const periodStart = inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null;
        const periodEnd = inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null;
        const paidAt = inv.status === 'paid' && inv.status_transitions?.paid_at
          ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
          : null;
        // Compose description: line items if available
        const desc = (inv.lines?.data?.[0]?.description as string | undefined) || null;
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
            userId,
            inv.id,
            subscriptionId,
            inv.amount_due,
            inv.amount_paid,
            inv.currency,
            inv.status,
            desc,
            inv.hosted_invoice_url || null,
            inv.invoice_pdf || null,
            periodStart,
            periodEnd,
            paidAt,
          ]
        );
        break;
      }

      default:
        // Unhandled — record but don't error
        break;
    }

    await query(`UPDATE or_stripe_events SET processed = true WHERE id = $1`, [event.id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[webhook] handler error for ${event.type}:`, (e as Error).message);
    // Mark processed=false so we can re-process. Return 500 so Stripe retries.
    return NextResponse.json({ error: 'handler error' }, { status: 500 });
  }
}
