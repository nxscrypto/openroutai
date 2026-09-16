import { NextResponse } from 'next/server';
import { Client } from 'pg';

// GET /api/diag/dbtest — tests Postgres + lists actual tables
export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ ok: false, error: 'DATABASE_URL not set' }, { status: 500 });
  }
  const c = new Client({
    connectionString: url,
    ssl: url.includes('railway') || url.includes('rlwy') ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await c.connect();
    const info = await c.query("SELECT current_database() as db, current_user as user");
    const tables = await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    return NextResponse.json({
      ok: true,
      db: info.rows[0],
      tables: tables.rows.map(r => r.tablename),
      or_invoices_exists: tables.rows.some(r => r.tablename === 'or_invoices'),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  } finally {
    await c.end().catch(() => {});
  }
}
