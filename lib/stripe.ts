import Stripe from 'stripe';

let _stripe: Stripe | null = null;

// Helpers that accept EITHER uppercase or lowercase env var names (Railway
// auto-injects as lowercase 'stripe_secret', but docs convention is uppercase).
function pickSecret(): string | null {
  return process.env.STRIPE_SECRET || process.env.stripe_secret || null;
}
function pickPublishable(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY
    || process.env.stripe_publishable_key
    || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    || null;
}
function pickWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET
    || process.env.stripe_webhook_secret
    || null;
}

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = pickSecret();
  if (!key) {
    throw new Error('STRIPE_SECRET env var is not set. Add it in Railway → Variables.');
  }
  _stripe = new Stripe(key, {
    // Pin to the SDK's expected API version (Stripe SDK v17+).
    apiVersion: '2025-02-24.acacia',
  });
  return _stripe;
}

export function stripeConfigured(): boolean {
  return Boolean(pickSecret());
}

export function publishableKey(): string | null {
  return pickPublishable();
}

export function webhookSecret(): string | null {
  return pickWebhookSecret();
}
