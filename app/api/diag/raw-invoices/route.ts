import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const invs = await query(
    `SELECT stripe_invoice_id, stripe_subscription_id, amount_paid_cents, status, kind, description, created_at
     FROM or_invoices ORDER BY created_at DESC LIMIT 20`
  );
  const subs = await query(
    `SELECT id, stripe_subscription_id, stripe_price_id, status FROM or_subscriptions`
  );
  return NextResponse.json({ invoices: invs.rows, subscriptions: subs.rows });
}
