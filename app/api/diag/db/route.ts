import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// POST /api/diag/db - test database connectivity and table presence.
// Returns detailed error info. Safe to expose during debugging.
export async function GET() {
  try {
    // 1. Test basic connectivity
    const result = await query<{ now: string; current_user: string; current_database: string }>(
      `SELECT now()::text as now, current_user, current_database()`
    );
    const info = result.rows[0];

    // 2. List our tables
    const tables = await query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'or_%' ORDER BY tablename`
    );

    // 3. Try to count users
    let userCount = null;
    let userCountError: string | null = null;
    try {
      const r = await query<{ c: string }>(`SELECT COUNT(*)::text as c FROM or_users`);
      userCount = r.rows[0]?.c;
    } catch (e) {
      userCountError = (e as Error).message;
    }

    return NextResponse.json({
      ok: true,
      db: info,
      or_tables: tables.rows.map(r => r.tablename),
      user_count: userCount,
      user_count_error: userCountError,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: (e as Error).message,
      stack: (e as Error).stack?.split('\n').slice(0, 5).join('\n'),
    }, { status: 500 });
  }
}
