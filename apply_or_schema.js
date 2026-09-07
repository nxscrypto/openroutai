#!/usr/bin/env node
// Apply the openroutai schema (or_*) to whichever DATABASE_URL the user provides.
// Used to bootstrap a fresh Postgres for openroutai.
const { Client } = require('pg');
const fs = require('fs');

const url = process.argv[2];
if (!url) {
  console.error('Usage: node apply_or_schema.js <DATABASE_URL>');
  process.exit(1);
}

const sql = fs.readFileSync('/Users/bsac/openroutai/db/schema.sql', 'utf8');

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  console.log('Connected.');

  // Check if tables already exist
  const before = await c.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'or_%' ORDER BY tablename`
  );
  console.log(`Existing or_* tables: ${before.rows.length}`);
  for (const r of before.rows) console.log('  -', r.tablename);

  await c.query(sql);
  console.log('\nSchema applied.');

  const after = await c.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'or_%' ORDER BY tablename`
  );
  console.log(`\nAfter: ${after.rows.length} or_* tables:`);
  for (const r of after.rows) console.log('  -', r.tablename);

  await c.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
