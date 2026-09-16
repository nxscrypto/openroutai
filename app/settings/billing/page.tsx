import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { stripeConfigured, getStripe } from '@/lib/stripe';

interface Card {
  stripe_payment_method_id: string;
  brand: string;
  last4: string;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
  created_at: string;
}

export default async function BillingPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const cards = await query<Card>(
    `SELECT stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default, created_at
     FROM or_payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [user.id]
  );

  const stripeReady = stripeConfigured();
  let products: any[] = [];
  let productError: string | null = null;

  if (stripeReady) {
    try {
      const stripe = getStripe();
      const prods = await stripe.products.list({ active: true, limit: 20 });
      for (const p of prods.data) {
        const prices = await stripe.prices.list({ product: p.id, active: true, limit: 5 });
        products.push({
          id: p.id,
          name: p.name,
          prices: prices.data.map(pr => ({
            id: pr.id,
            amount: pr.unit_amount,
            currency: pr.currency,
            recurring: pr.recurring ? { interval: pr.recurring.interval } : null,
          })),
        });
      }
    } catch (e) {
      productError = (e as Error).message;
    }
  }

  return (
    <div>
      <h1 className="text-[26px] font-semibold mb-4">Billing</h1>
      <p>Cards on file: {cards.rows.length}</p>
      <p>Stripe configured: {stripeReady ? 'yes' : 'no'}</p>
      <p>Products: {products.length}</p>
      {productError && <p style={{color:'red'}}>Product error: {productError}</p>}
    </div>
  );
}
