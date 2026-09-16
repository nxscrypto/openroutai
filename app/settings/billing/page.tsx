import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { stripeConfigured, getStripe } from '@/lib/stripe';
import AddCardForm from './AddCardForm';
import BuyButton from './BuyButton';

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
  let user;
  try {
    user = await getSessionUser();
  } catch (e) {
    console.error('[billing] getSessionUser failed:', (e as Error).message);
    return (
      <div className="bg-[#3a1a1a] text-[#ff8585] rounded-[12px] p-4">
        Auth error: {(e as Error).message}
      </div>
    );
  }
  if (!user) redirect('/login');

  let cards: { rows: Card[] } = { rows: [] };
  let subs: { rows: Sub[] } = { rows: [] };
  let invoices: { rows: Invoice[] } = { rows: [] };

  try {
    cards = await query<Card>(
      `SELECT stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default, created_at
       FROM or_payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [user.id]
    );
  } catch (e) {
    console.error('[billing] cards query failed:', (e as Error).message);
  }

  try {
    subs = await query<Sub>(
      `SELECT id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, stripe_price_id
       FROM or_subscriptions WHERE user_id = $1 ORDER BY created_at DESC`,
      [user.id]
    );
  } catch (e) {
    console.error('[billing] subs query failed:', (e as Error).message);
  }

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

  let products: Array<any> = [];
  const stripeReady = stripeConfigured();
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
            recurring: pr.recurring ? { interval: pr.recurring.interval } : null,
          })),
        });
      }
    } catch (e) {
      console.error('[billing] products fetch failed:', (e as Error).message);
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

      {/* Payment methods */}
      <div className="bg-surface hairline rounded-[14px] p-7 mb-6">
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-4 mb-1">Payment methods</div>
          <div className="text-[14px] text-text-2">Cards on file for future charges</div>
        </div>

        {cards.rows.length === 0 ? (
          <div className="text-[13px] text-text-4 mb-4">No cards on file yet.</div>
        ) : (
          <div className="space-y-3 mb-5">
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

        {stripeReady && (
          <div className="mt-4 pt-5 border-t border-border">
            <div className="text-[12px] uppercase tracking-[0.16em] text-text-4 mb-3">Add a new card</div>
            <AddCardForm />
          </div>
        )}
      </div>

      {/* Invoices */}
      {invoices.rows.length > 0 && (
        <div className="bg-surface hairline rounded-[14px] p-7 mb-6">
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-4 mb-3">Invoices</div>
          <div className="space-y-2">
            {invoices.rows.map((inv) => {
              const amt = ((inv.amount_paid_cents || inv.amount_due_cents) / 100).toFixed(2);
              const cur = inv.currency.toUpperCase();
              const created = new Date(inv.created_at);
              const isPaid = inv.status === 'paid';
              return (
                <div key={inv.id} className="flex items-center justify-between bg-card-alt hairline rounded-[10px] px-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10.5px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded ${isPaid ? 'bg-[#1e3a23] text-[#7fd490]' : 'bg-[#3a2a17] text-[#ffd479]'}`}>
                        {inv.status}
                      </span>
                      <span className="text-[14px] font-mono">${amt} {cur}</span>
                      <span className="text-[11.5px] text-text-4">·</span>
                      <span className="text-[11.5px] text-text-4">{created.toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {inv.hosted_invoice_url && (
                      <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer"
                        className="text-[12px] text-text-2 hover:text-text underline px-2 py-1">View</a>
                    )}
                    {inv.invoice_pdf_url && (
                      <a href={inv.invoice_pdf_url} target="_blank" rel="noopener noreferrer"
                        className="text-[12px] font-semibold text-bg bg-accent hover:bg-accent-hover rounded-full px-3 py-1.5 transition-colors">PDF</a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available products */}
      {stripeReady && products.length > 0 && (
        <div className="bg-surface hairline rounded-[14px] p-7 mb-6">
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-4 mb-3">Plans &amp; services</div>
          <div className="grid gap-3">
            {products.map((p: any) => (
              <div key={p.id} className="bg-card-alt hairline rounded-[12px] p-5">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <div className="text-[16px] font-semibold">{p.name}</div>
                  {p.description && <div className="text-[12px] text-text-4 text-right max-w-[60%]">{p.description}</div>}
                </div>
                <div className="space-y-2 mt-3">
                  {p.prices.map((pr: any) => (
                    <div key={pr.id} className="flex items-center justify-between bg-bg/40 rounded-[8px] px-3 py-2.5">
                      <div>
                        <div className="text-[14px] font-mono">{fmtPrice(pr.amount, pr.currency, pr.recurring)}</div>
                      </div>
                      <BuyButton priceId={pr.id} label={pr.recurring ? 'Subscribe' : 'Buy'} />
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
          <a
            href={`/api/stripe/portal?customer_id=${user.stripe_customer_id}`}
            className="text-[12.5px] text-text-4 hover:text-text underline"
          >
            Manage billing &amp; view invoices in the Stripe portal →
          </a>
        </div>
      )}
    </div>
  );
}
