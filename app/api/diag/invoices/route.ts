import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/diag/invoices?email=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = url.searchParams.get('email');
  try {
    // Inspect schemas
    const tables = await query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name IN ('or_invoices','or_stripe_events','or_users','or_subscriptions','or_payment_methods')
       ORDER BY table_name, ordinal_position`
    );
    const total = await query<{ c: number }>('SELECT count(*)::int as c FROM or_invoices');
    let userData: { user: any; invoices: any[] } | null = null;
    if (email) {
      const u = await query<{ id: string; email: string; stripe_customer_id: string | null }>(
        `SELECT id, email, stripe_customer_id FROM or_users WHERE email = $1`, [email]
      );
      if (u.rows[0]) {
        const inv = await query(
          `SELECT stripe_invoice_id, status, amount_due_cents, amount_paid_cents FROM or_invoices WHERE user_id = $1`, [u.rows[0].id]
        );
        userData = { user: u.rows[0], invoices: inv.rows };
      }
    }
    return NextResponse.json({
      total_invoices: total.rows[0]?.c ?? 0,
      schema: tables.rows,
      user: userData,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
