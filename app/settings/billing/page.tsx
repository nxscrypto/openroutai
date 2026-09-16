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

interface Sub {
  id: string;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_price_id: string | null;
}

interface Invoice {
  id: string;
  stripe_invoice_id: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  currency: string;
  status: string;
  description: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  created_at: string;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
}

export default async function BillingPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const cards = await query<Card>(
    `SELECT stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default, created_at
     FROM or_payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [user.id]
  );

  const subs = await query<Sub>(
    `SELECT id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, stripe_price_id
     FROM or_subscriptions WHERE user_id = $1 ORDER BY created_at DESC`,
    [user.id]
  );

  let invoices: { rows: Invoice[] } = { rows: [] };
  try {
    invoices = await query<Invoice>(
      `SELECT id, stripe_invoice_id, amount_due_cents, amount_paid_cents, currency, status,
              description, hosted_invoice_url, invoice_pdf_url, created_at, paid_at,
              period_start, period_end
       FROM or_invoices WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [user.id]
    );
  } catch (e) {
    console.error('[billing] invoices query failed:', (e as Error).message);
  }

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
      <p>Cards: {cards.rows.length}, Subs: {subs.rows.length}, Invoices: {invoices.rows.length}, Products: {products.length}</p>
      {productError && <p style={{color:'red'}}>Product error: {productError}</p>}
    </div>
  );
}
