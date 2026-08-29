// SECURITY (audit C-01, 2026-08-30): connection details come from the
// environment (DATABASE_URL or discrete PG* variables) — no credentials
// in source. The old hardcoded host/password were removed.
const pg = require('pg')

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('ERROR: DATABASE_URL environment variable is required')
  process.exit(1)
}

const c = new pg.Client({ connectionString })

c.connect()
  .then(() => c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"))
  .then(r => {
    console.log('Existing tables:')
    r.rows.forEach(t => console.log(' -', t.table_name))
    c.end()
  })
  .catch(e => console.log('Error:', e.message))
