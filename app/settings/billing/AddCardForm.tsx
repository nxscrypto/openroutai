'use client';

import { useEffect, useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { StripeElementsOptions } from '@stripe/stripe-js';

// Client-only component. Manages its own success state via window reload after
// Stripe confirms the setup. No event-handler props are passed in.

interface SetupData {
  client_secret: string;
  customer_id: string;
  publishable_key: string;
}

let stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise(pk: string) {
  if (!stripePromise) stripePromise = loadStripe(pk);
  return stripePromise;
}

// Minimal CardElement options — visual styling goes through Elements `appearance`
const CARD_OPTIONS = {
  hidePostalCode: true,  // we collect ZIP separately below
};

function CardForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [zip, setZip] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    const cardEl = elements.getElement(CardElement);
    if (!cardEl) return;

    setSubmitting(true);
    setError(null);

    // Use redirect: 'always' so Stripe Link auth → returns to ?added=1 cleanly
    const { error: stripeErr } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/settings/billing?added=1`,
        payment_method_data: {
          billing_details: {
            name: name.trim() || undefined,
            address: { postal_code: zip.trim() || undefined },
          },
        },
      },
      redirect: 'if_required',  // for non-Link cards, finish inline
    });

    if (stripeErr) {
      setError(stripeErr.message || 'Something went wrong');
      setSubmitting(false);
      return;
    }

    // If confirmSetup returned without redirect (e.g. Link auth was required
    // and user completed it inline), reload to pick up the new card.
    // Otherwise Stripe has already redirected to ?added=1 and this code is moot.
    window.location.href = `${window.location.origin}/settings/billing?added=1`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-[11.5px] uppercase tracking-[0.14em] text-text-4 mb-2">
          Name on card
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Brent Campbell"
          autoComplete="cc-name"
          className="w-full bg-bg border border-border rounded-[10px] px-4 py-3 text-[14px] text-text placeholder-text-4 focus:outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="block text-[11.5px] uppercase tracking-[0.14em] text-text-4 mb-2">
          Card details
        </label>
        <div className="bg-bg border border-border rounded-[10px] p-4">
          <CardElement options={CARD_OPTIONS} />
        </div>
      </div>

      <div>
        <label className="block text-[11.5px] uppercase tracking-[0.14em] text-text-4 mb-2">
          ZIP / Postal code
        </label>
        <input
          type="text"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          placeholder="33305"
          autoComplete="postal-code"
          maxLength={10}
          className="w-full bg-bg border border-border rounded-[10px] px-4 py-3 text-[14px] text-text placeholder-text-4 focus:outline-none focus:border-accent"
        />
      </div>

      {error && (
        <div className="bg-[#3a1a1a] text-[#ff8585] rounded-[10px] px-4 py-3 text-[13px]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full text-[14px] font-semibold text-bg bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-full px-5 py-3 shadow-btn-primary transition-colors"
      >
        {submitting ? 'Saving card…' : 'Save card'}
      </button>
    </form>
  );
}

export default function AddCardForm() {
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stripe/setup-intent', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setFetchError(data.error + (data.detail ? `: ${data.detail}` : ''));
        } else {
          setSetupData(data);
        }
      })
      .catch((e) => setFetchError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-[13px] text-text-4 py-4 text-center">Loading payment form…</div>;
  }
  if (fetchError || !setupData) {
    return (
      <div className="bg-[#3a1a1a] text-[#ff8585] rounded-[10px] p-4 text-[13px]">
        Could not start payment: {fetchError || 'unknown'}
      </div>
    );
  }

  const stripe = getStripePromise(setupData.publishable_key);
  const options: StripeElementsOptions = {
    clientSecret: setupData.client_secret,
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#7dd3a0',
        colorBackground: '#1a1a1a',
        colorText: '#e8e8e8',
        colorDanger: '#ff8585',
        fontFamily: 'Inter, system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '10px',
      },
    },
  };

  return (
    <Elements stripe={stripe} options={options}>
      <CardForm />
    </Elements>
  );
}
