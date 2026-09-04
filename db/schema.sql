-- Open Rout AI: users, sessions, subscriptions, payment_methods
-- Reuses the existing BSAC Railway Postgres.
-- All openroutai.com-specific tables are prefixed `or_` so they don't collide.

CREATE TABLE IF NOT EXISTS or_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text,
  email_verified boolean DEFAULT false,
  email_verify_token text,
  password_reset_token text,
  password_reset_expires timestamptz,
  stripe_customer_id text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- NextAuth-compatible session table (for JWT-less sessions if we switch)
CREATE TABLE IF NOT EXISTS or_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES or_users(id) ON DELETE CASCADE,
  expires timestamptz NOT NULL,
  session_token text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_or_sessions_user_id ON or_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_or_sessions_session_token ON or_sessions(session_token);

-- Stripe customer linkage + cached payment methods
CREATE TABLE IF NOT EXISTS or_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES or_users(id) ON DELETE CASCADE,
  stripe_payment_method_id text UNIQUE NOT NULL,
  brand text NOT NULL,
  last4 text NOT NULL,
  exp_month int,
  exp_year int,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_or_payment_methods_user_id ON or_payment_methods(user_id);

-- Subscriptions (basic for now — one row per active sub)
CREATE TABLE IF NOT EXISTS or_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES or_users(id) ON DELETE CASCADE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  status text NOT NULL DEFAULT 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  canceled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_or_subscriptions_user_id ON or_subscriptions(user_id);

-- Webhook event log — for idempotency + debugging
CREATE TABLE IF NOT EXISTS or_stripe_events (
  id text PRIMARY KEY, -- Stripe event id (evt_*) for idempotency
  type text NOT NULL,
  received_at timestamptz DEFAULT now(),
  processed boolean DEFAULT false,
  payload jsonb
);
CREATE INDEX IF NOT EXISTS idx_or_stripe_events_type ON or_stripe_events(type);

-- API keys for the user-facing API (Open Rout AI's own keys, not Stripe)
CREATE TABLE IF NOT EXISTS or_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES or_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text UNIQUE NOT NULL,
  key_prefix text NOT NULL,
  last_used_at timestamptz,
  revoked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_or_api_keys_user_id ON or_api_keys(user_id);

-- updated_at trigger for or_users + or_subscriptions
CREATE OR REPLACE FUNCTION or_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_or_users_updated_at ON or_users;
CREATE TRIGGER trg_or_users_updated_at BEFORE UPDATE ON or_users
  FOR EACH ROW EXECUTE FUNCTION or_set_updated_at();

DROP TRIGGER IF EXISTS trg_or_subscriptions_updated_at ON or_subscriptions;
CREATE TRIGGER trg_or_subscriptions_updated_at BEFORE UPDATE ON or_subscriptions
  FOR EACH ROW EXECUTE FUNCTION or_set_updated_at();
