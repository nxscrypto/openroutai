import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { stripeConfigured, publishableKey } from '@/lib/stripe';

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
    `SELECT status, current_period_end, cancel_at_period_end, stripe_price_id
     FROM or_subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [user.id]
  );

  const stripeReady = stripeConfigured();
  const pk = publishableKey();

  return (
    <div className="max-w-[760px]">
      <h1 className="text-[26px] font-semibold mb-1">Billing</h1>
      <p className="text-[13.5px] text-text-4 mb-8">Add a payment method, manage your plan, view invoices.</p>

      {!stripeReady && (
        <div className="bg-[#3a2a17] text-[#ffd479] rounded-[12px] p-4 mb-6 text-[13px]">
          <strong>Stripe is not configured on this server.</strong>{' '}
          Add <code>STRIPE_SECRET</code> and <code>STRIPE_PUBLISHABLE_KEY</code> as Railway env vars, then redeploy.
        </div>
      )}

      {/* Active subscription */}
      <div className="bg-surface hairline rounded-[14px] p-7 mb-6">
        <div className="text-[11px] uppercase tracking-[0.16em] text-text-4 mb-2">Plan</div>
        {subs.rows[0] ? (
          <div>
            <div className="text-[18px] font-semibold capitalize">{subs.rows[0].status.replace(/_/g, ' ')}</div>
            {subs.rows[0].current_period_end && (
              <div className="text-[12.5px] text-text-4 mt-1">
                Renews {new Date(subs.rows[0].current_period_end).toLocaleDateString()}
                {subs.rows[0].cancel_at_period_end && ' (will cancel at period end)'}
              </div>
            )}
          </div>
        ) : (
          <div className="text-[14px] text-text-3">
            No active subscription.{' '}
            <span className="text-text-4 text-[12.5px]">Card-on-file is supported; subscriptions coming soon.</span>
          </div>
        )}
      </div>

      {/* Payment methods */}
      <div className="bg-surface hairline rounded-[14px] p-7">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-text-4 mb-1">Payment methods</div>
            <div className="text-[14px] text-text-2">Cards on file for future charges</div>
          </div>
          {stripeReady && user.stripe_customer_id && (
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

      {/* Open Stripe customer portal — visible once we have a customer */}
      {user.stripe_customer_id && stripeReady && (
        <div className="mt-6 text-center">
          <form action="/api/stripe/portal" method="POST" className="inline">
            <button type="submit" className="text-[12.5px] text-text-4 hover:text-text underline">
              Manage billing &amp; view invoices in the Stripe portal →
            </button>
          </form>
        </div>
      )}

      {/* Debug: show publishable key for sanity-check */}
      {pk && (
        <div className="mt-8 text-[10.5px] text-text-4 font-mono break-all opacity-50">
          pk: {pk.slice(0, 20)}…{pk.slice(-8)}
        </div>
      )}
    </div>
  );
}
