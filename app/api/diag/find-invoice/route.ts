import { NextResponse, type NextRequest } from 'next/server';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// GET /api/diag/find-invoice?amount=39900&days=30
// Searches Stripe for any invoice matching the amount in the last N days.
export async function GET(req: NextRequest) {
  const stripe = getStripe();
  const url = new URL(req.url);
  const amount = parseInt(url.searchParams.get('amount') || '0');
  const days = parseInt(url.searchParams.get('days') || '30');
  const since = Math.floor(Date.now() / 1000) - days * 86400;

  try {
    const all = await stripe.invoices.list({ limit: 100, created: { gte: since } });
    const matches = all.data.filter(inv => inv.amount_due === amount);
    return NextResponse.json({
      searched_amount: amount,
      searched_since: new Date(since * 1000).toISOString(),
      matches: matches.map((inv: any) => ({
        id: inv.id,
        number: inv.number,
        amount_due: inv.amount_due,
        amount_paid: inv.amount_paid,
        status: inv.status,
        customer: inv.customer,
        customer_email: inv.customer_email,
        customer_name: inv.customer_name,
        created: inv.created,
        hosted_invoice_url: inv.hosted_invoice_url,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
