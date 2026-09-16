import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { stripeConfigured } from '@/lib/stripe';

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

  const stripeReady = stripeConfigured();

  // Pull active products from Stripe
  let products: Array<{
    id: string;
    name: string;
    description: string | null;
    prices: Array<{
      id: string;
      amount: number | null;
      currency: string;
      recurring: { interval: string; interval_count: number } | null;
      nickname: string | null;
    }>;
  }> = [];

  if (stripeReady) {
    try {
      const stripe = getStripe();
      const prods = await stripe.products.list({ active: true, limit: 20 });
      for (const p of prods.data) {
        const prices = await stripe.prices.list({ product: p.id, active: true, limit: 5 });
        products.push({
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
    } catch (e) {
      console.error('[billing] product list error:', (e as Error).message);
    }
  }

  const fmtPrice = (cents: number | null, currency: string, recurring?: { interval: string } | null) => {
    if (cents === null) return '';
    const amt = (cents / 100).toFixed(2);
    const cur = currency.toUpperCase();
    return `$${amt} ${cur}${recurring ? ` / ${recurring.interval}` : ''}`;
  };

  return (
    <div className="max-w-[920px]">
      <h1 className="text-[26px] font-semibold mb-1">Billing</h1>
      <p className="text-[13.5px] text-text-4 mb-8">Add a payment method, choose a plan, view invoices.</p>

      {!stripeReady && (
        <div className="bg-[#3a2a17] text-[#ffd479] rounded-[12px] p-4 mb-6 text-[13px]">
          <strong>Stripe is not configured on this server.</strong>{' '}
          Add <code>stripe_secret</code> and <code>stripe_publishable_key</code> as Railway env vars, then redeploy.
        </div>
      )}

      {/* Payment methods — always show Add card button when Stripe is configured */}
      <div className="bg-surface hairline rounded-[14px] p-7 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-text-4 mb-1">Payment methods</div>
            <div className="text-[14px] text-text-2">Cards on file for future charges</div>
          </div>
          {stripeReady && (
            <form action="/api/stripe/checkout" method="POST">
              <button
                type="submit"
                className="text-[13px] font-semibold text-bg bg-accent rounded-full px-5 py-2.5 shadow-btn-primary hover:bg-accent-hover transition-colors"
              >
                Add card
              </button>
            </form>
          )}
        </div>

        {cards.rows.length === 0 ? (
          <div className="text-[13px] text-text-4 py-4 text-center border border-dashed border-border rounded-[10px]">
            No cards on file yet.
          </div>
        ) : (
          <div className="space-y-3">
            {cards.rows.map((c) => (
              <div key={c.stripe_payment_method_id} className="flex items-center justify-between bg-card-alt hairline rounded-[10px] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="text-[20px]">💳</div>
                  <div>
                    <div className="text-[14px] capitalize">{c.brand} •••• {c.last4}</div>
                    {c.exp_month && c.exp_year && (
                      <div className="text-[11.5px] text-text-4">Exp {String(c.exp_month).padStart(2, '0')}/{c.exp_year}</div>
                    )}
                  </div>
                </div>
                {c.is_default && (
                  <span className="text-[10.5px] uppercase tracking-[0.16em] text-accent">Default</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active subscriptions */}
      {subs.rows.length > 0 && (
        <div className="bg-surface hairline rounded-[14px] p-7 mb-6">
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-4 mb-3">Active subscriptions</div>
          <div className="space-y-3">
            {subs.rows.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-card-alt hairline rounded-[10px] px-4 py-3">
                <div>
                  <div className="text-[14px] font-semibold capitalize">{s.status.replace(/_/g, ' ')}</div>
                  {s.current_period_end && (
                    <div className="text-[11.5px] text-text-4 mt-0.5">
                      {s.cancel_at_period_end ? 'Cancels' : 'Renews'} {new Date(s.current_period_end).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-text-4 font-mono">{s.stripe_price_id?.slice(0, 18) || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available products */}
      {stripeReady && products.length > 0 && (
        <div className="bg-surface hairline rounded-[14px] p-7 mb-6">
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-4 mb-3">Plans &amp; services</div>
          <div className="grid gap-3">
            {products.map((p) => (
              <div key={p.id} className="bg-card-alt hairline rounded-[12px] p-5">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <div className="text-[16px] font-semibold">{p.name}</div>
                  {p.description && <div className="text-[12px] text-text-4 text-right max-w-[60%]">{p.description}</div>}
                </div>
                <div className="space-y-2 mt-3">
                  {p.prices.map((pr) => (
                    <div key={pr.id} className="flex items-center justify-between bg-bg/40 rounded-[8px] px-3 py-2.5">
                      <div>
                        <div className="text-[14px] font-mono">{fmtPrice(pr.amount, pr.currency, pr.recurring)}</div>
                        {pr.nickname && <div className="text-[11px] text-text-4">{pr.nickname}</div>}
                      </div>
                      <form action="/api/stripe/checkout" method="POST">
                        <input type="hidden" name="price_id" value={pr.id} />
                        <button
                          type="submit"
                          className="text-[12.5px] font-semibold text-bg bg-accent rounded-full px-4 py-2 shadow-btn-primary hover:bg-accent-hover transition-colors"
                        >
                          {pr.recurring ? 'Subscribe' : 'Buy'}
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stripe customer portal */}
      {user.stripe_customer_id && stripeReady && (
        <div className="mt-6 text-center">
          <form action="/api/stripe/portal" method="POST" className="inline">
            <button type="submit" className="text-[12.5px] text-text-4 hover:text-text underline">
              Manage billing &amp; view invoices in the Stripe portal →
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
