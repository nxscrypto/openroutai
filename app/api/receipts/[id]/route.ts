import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/receipts/[id]?charge=ch_...
// Returns the receipt data for an invoice (real or backfilled charge).
// Used by the /receipts/[id] page.
//
// NOT auth-gated because invoice URLs are scoped via long random IDs;
// in production you'd want a signed URL or signed cookie.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const invoiceId = params.id;

  const r = await query<{
    id: string;
    user_id: string;
    stripe_invoice_id: string;
    amount_due_cents: number;
    amount_paid_cents: number;
    currency: string;
    status: string;
    description: string | null;
    created_at: string;
    paid_at: string | null;
    kind: string | null;
    user_email: string;
  }>(
    `SELECT i.id, i.user_id, i.stripe_invoice_id, i.amount_due_cents, i.amount_paid_cents,
            i.currency, i.status, i.description, i.created_at, i.paid_at, i.kind,
            u.email AS user_email
     FROM or_invoices i
     LEFT JOIN or_users u ON u.id = i.user_id
     WHERE i.id = $1
     LIMIT 1`,
    [invoiceId]
  );

  if (r.rows.length === 0) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  }

  const inv = r.rows[0];
  return NextResponse.json({
    id: inv.id,
    number: inv.stripe_invoice_id,
    amount_paid_cents: inv.amount_paid_cents,
    amount_due_cents: inv.amount_due_cents,
    currency: inv.currency,
    status: inv.status,
    description: inv.description,
    created_at: inv.created_at,
    paid_at: inv.paid_at,
    kind: inv.kind,
    recipient: inv.user_email,
  });
}
