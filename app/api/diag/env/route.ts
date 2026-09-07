import { NextResponse } from 'next/server';

// /api/diag/env - TEMPORARY: shows which env vars the running deploy sees.
// Safe to expose because it only shows PRESENCE (true/false), not values.
export async function GET() {
  const checks = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    DATABASE_PUBLIC_URL: Boolean(process.env.DATABASE_PUBLIC_URL),
    PGHOST: Boolean(process.env.PGHOST),
    PGPORT: Boolean(process.env.PGPORT),
    PGUSER: Boolean(process.env.PGUSER),
    PGPASSWORD: Boolean(process.env.PGPASSWORD),
    PGDATABASE: Boolean(process.env.PGDATABASE),
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
    STRIPE_SECRET: Boolean(process.env.STRIPE_SECRET),
    STRIPE_PUBLISHABLE_KEY: Boolean(process.env.STRIPE_PUBLISHABLE_KEY),
    stripe_secret: Boolean(process.env.stripe_secret),
    stripe_publishable_key: Boolean(process.env.stripe_publishable_key),
    STRIPE_WEBHOOK_SECRET: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    NODE_ENV: process.env.NODE_ENV,
    RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
  };
  return NextResponse.json(checks);
}
