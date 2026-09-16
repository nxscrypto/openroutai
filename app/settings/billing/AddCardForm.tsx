'use client';

import { useEffect, useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { StripeElementsOptions } from '@stripe/stripe-js';

// Client-only component. Manages its own success state via window reload after
// Stripe confirms the setup. No event-handler props are passed in — the parent
// server component just renders <AddCardForm />.

interface SetupData {
  client_secret: string;
  customer_id: string;
  publishable_key: string;
}

// Cache the Stripe promise so we only load it once per session
let stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise(pk: string) {
  if (!stripePromise) stripePromise = loadStripe(pk);
  return stripePromise;
}

const CARD_OPTIONS = {
  hidePostalCode: false,
  style: {
    base: {
      color: '#e8e8e8',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      fontSize: '15px',
      fontSmoothing: 'antialiased',
      '::placeholder': { color: '#6b6b6b' },
      iconColor: '#7dd3a0',
    },
    invalid: {
      color: '#ff8585',
      iconColor: '#ff8585',
    },
  },
};

function CardForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    const cardEl = elements.getElement(CardElement);
    if (!cardEl) return;

    setSubmitting(true);
    setError(null);

    const { error: stripeErr, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/settings/billing?added=1`,
      },
      redirect: 'if_required',
    });

    if (stripeErr) {
      setError(stripeErr.message || 'Something went wrong');
      setSubmitting(false);
      return;
    }
    if (setupIntent && setupIntent.status === 'succeeded') {
      // Reload the page to pick up the new card
      window.location.reload();
    } else {
      setError('Setup did not complete. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-bg border border-border rounded-[10px] p-4">
        <CardElement options={CARD_OPTIONS} />
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
    return (
      <div className="text-[13px] text-text-4 py-4 text-center">Loading payment form…</div>
    );
  }
  if (fetchError || !setupData) {
    return (
      <div className="bg-[#3a1a1a] text-[#ff8585] rounded-[10px] p-4 text-[13px]">
        Could not start payment: {fetchError || 'unknown'}
      </div>
    );
  }

  const stripePromise = getStripePromise(setupData.publishable_key);
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
    <Elements stripe={stripePromise} options={options}>
      <CardForm />
    </Elements>
  );
}
