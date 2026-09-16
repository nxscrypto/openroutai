import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/diag/invoices?email=...
// Lists invoices from DB and last webhook events for debugging.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = url.searchParams.get('email');
  try {
    // Total invoices in DB
    const total = await query('SELECT count(*)::int as c FROM or_invoices');
    // Recent events
    const events = await query(
      `SELECT id, type, processed, created_at
       FROM or_stripe_events ORDER BY created_at DESC LIMIT 20`
    );
    // If email provided, show that user's invoices + events
    let userData: any = null;
    if (email) {
      const u = await query<{ id: string; email: string; stripe_customer_id: string | null }>(
        `SELECT id, email, stripe_customer_id FROM or_users WHERE email = $1`, [email]
      );
      if (u.rows[0]) {
        const inv = await query(
          `SELECT stripe_invoice_id, status, amount_due_cents, amount_paid_cents, created_at
           FROM or_invoices WHERE user_id = $1 ORDER BY created_at DESC`, [u.rows[0].id]
        );
        userData = { user: u.rows[0], invoices: inv.rows };
      }
    }
    return NextResponse.json({
      total_invoices: total.rows[0].c,
      recent_events: events.rows,
      user: userData,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// Need NextRequest for the import above
import type { NextRequest } from 'next/server';
