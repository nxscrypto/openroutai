import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';

// GET /api/products — fetches active Stripe products + their prices.
// Returns: [{id, name, description, prices: [{id, amount, currency, recurring}]}]
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const stripe = getStripe();
    const products = await stripe.products.list({ active: true, limit: 20 });
    const out = [];
    for (const p of products.data) {
      const prices = await stripe.prices.list({ product: p.id, active: true, limit: 5 });
      out.push({
        id: p.id,
        name: p.name,
        description: p.description,
        prices: prices.data.map(pr => ({
          id: pr.id,
          amount: pr.unit_amount,
          currency: pr.currency,
          recurring: pr.recurring ? { interval: pr.recurring.interval, interval_count: pr.recurring.interval_count } : null,
          nickname: pr.nickname,
        })),
      });
    }
    return NextResponse.json({ products: out });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
