import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

// POST /api/migrate — applies db/schema.sql to whichever Postgres DATABASE_URL points to.
// Requires header X-Migrate-Key matching MIGRATE_KEY env var (so random users can't trigger it).
// One-time use: after migration succeeds, remove this route from the repo.
export async function POST(req: NextRequest) {
  const provided = req.headers.get('x-migrate-key');
  const expected = process.env.MIGRATE_KEY || '';
  if (!expected) {
    return NextResponse.json({ error: 'MIGRATE_KEY env var not set on server' }, { status: 503 });
  }
  if (provided !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  if (!url) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 });
  }

  // Inline schema (so we don't need to read from disk at runtime in production)
  const schema = `
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

    CREATE TABLE IF NOT EXISTS or_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES or_users(id) ON DELETE CASCADE,
      expires timestamptz NOT NULL,
      session_token text UNIQUE NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_or_sessions_user_id ON or_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_or_sessions_session_token ON or_sessions(session_token);

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

    CREATE TABLE IF NOT EXISTS or_stripe_events (
      id text PRIMARY KEY,
      type text NOT NULL,
      received_at timestamptz DEFAULT now(),
      processed boolean DEFAULT false,
      payload jsonb
    );
    CREATE INDEX IF NOT EXISTS idx_or_stripe_events_type ON or_stripe_events(type);

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

    CREATE OR REPLACE FUNCTION or_set_updated_at() RETURNS trigger AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_or_users_updated_at ON or_users;
    CREATE TRIGGER trg_or_users_updated_at BEFORE UPDATE ON or_users
      FOR EACH ROW EXECUTE FUNCTION or_set_updated_at();

    DROP TRIGGER IF EXISTS trg_or_subscriptions_updated_at ON or_subscriptions;
    CREATE TRIGGER trg_or_subscriptions_updated_at BEFORE UPDATE ON or_subscriptions
      FOR EACH ROW EXECUTE FUNCTION or_set_updated_at();
  `;

  const c = new Client({
    connectionString: url,
    ssl: url.includes('rlwy.net') || url.includes('railway') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await c.connect();
    // Check before
    const before = await c.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'or_%' ORDER BY tablename`
    );
    // Apply
    await c.query(schema);
    // Check after
    const after = await c.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'or_%' ORDER BY tablename`
    );
    return NextResponse.json({
      ok: true,
      before: before.rows.map(r => r.tablename),
      after: after.rows.map(r => r.tablename),
      db: (await c.query('SELECT current_database() as db, current_user as user')).rows[0],
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: (e as Error).message,
      hint: 'Check DATABASE_URL points to the right Postgres, and that the schema is valid for that Postgres version',
    }, { status: 500 });
  } finally {
    await c.end().catch(() => {});
  }
}
