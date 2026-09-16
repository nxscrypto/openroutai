import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// POST /api/diag/dedupe-invoices
// For each user, find Stripe Invoices linked to a PaymentIntent that has
// a corresponding backfilled charge row (ch_*) and delete the charge row.
//
// Also: for any pair of (real invoice, backfilled charge) that match by
// amount + customer + ±60 seconds, delete the backfilled charge.
//
// Header: x-admin-key must match RESET_PASSWORD_KEY.
export async function POST(req: NextRequest) {
  const key = req.headers.get('x-admin-key');
  if (!key || key !== process.env.RESET_PASSWORD_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stripe = getStripe();

    // Find all backfilled charges
    const backfilled = await query<{
      id: string;
      user_id: string;
      stripe_invoice_id: string;
      amount_paid_cents: number;
      created_at: string;
      stripe_customer_id: string | null;
    }>(
      `SELECT i.id, i.user_id, i.stripe_invoice_id, i.amount_paid_cents, i.created_at,
              u.stripe_customer_id
       FROM or_invoices i
       LEFT JOIN or_users u ON u.id = i.user_id
       WHERE i.stripe_invoice_id LIKE 'ch_%'`
    );

    let deleted = 0;
    const errors: string[] = [];

    for (const row of backfilled.rows) {
      try {
        // Look for a real invoice in or_invoices for this user that:
        //  - has the same amount (or close), and
        //  - is within 5 minutes of the backfilled charge
        const dup = await query<{ id: string }>(
          `SELECT id FROM or_invoices
           WHERE user_id = $1
             AND stripe_invoice_id NOT LIKE 'ch_%'
             AND ABS(amount_paid_cents - $2) < 1
             AND ABS(EXTRACT(EPOCH FROM (created_at - $3::timestamptz))) < 300
           LIMIT 1`,
          [row.user_id, row.amount_paid_cents, row.created_at]
        );
        if (dup.rows.length > 0) {
          // Real invoice exists for same amount at same time — delete the charge row
          await query(`DELETE FROM or_invoices WHERE id = $1`, [row.id]);
          deleted++;
        }
      } catch (e) {
        errors.push(`${row.stripe_invoice_id}: ${(e as Error).message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      backfilled_checked: backfilled.rows.length,
      duplicates_removed: deleted,
      errors,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
