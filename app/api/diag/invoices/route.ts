import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const allInv = await query(
      `SELECT i.id, i.stripe_invoice_id, i.status, i.amount_due_cents,
              u.email, u.stripe_customer_id
       FROM or_invoices i
       LEFT JOIN or_users u ON u.id = i.user_id
       ORDER BY i.created_at DESC NULLS LAST
       LIMIT 20`
    );
    const allUsers = await query(
      `SELECT id, email, stripe_customer_id, created_at FROM or_users ORDER BY created_at DESC LIMIT 20`
    );
    return NextResponse.json({
      invoices: allInv.rows,
      users: allUsers.rows,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
