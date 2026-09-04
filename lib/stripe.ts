import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET;
  if (!key) {
    throw new Error('STRIPE_SECRET env var is not set. Add it in Railway → Variables.');
  }
  _stripe = new Stripe(key, {
    // Pin to the SDK's expected API version (Stripe SDK v17+).
    // Use '2025-02-24.acacia' to silence the LSP type warning.
    apiVersion: '2025-02-24.acacia',
  });
  return _stripe;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET);
}

export function publishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;
}

export function webhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}
