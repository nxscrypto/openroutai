import { Pool } from 'pg';

// Reuses the BSAC Railway Postgres. All openroutai.com tables are prefixed `or_`
// so they don't collide with BSAC Mission Control's tables.
declare global {
  // eslint-disable-next-line no-var
  var __orPool: Pool | undefined;
}

export const pool: Pool =
  global.__orPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__orPool = pool;
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  const r = await pool.query(text, params as never);
  return { rows: r.rows as T[] };
}
