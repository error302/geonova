const pg = require('pg')
const c = new pg.Client({
  host: '34.170.248.156',
  port: 5432,
  user: 'metardu',
  password: 'Dosho10701$',
  database: 'metardu'
})

c.connect()
  .then(() => c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"))
  .then(r => {
    console.log('Existing tables:')
    r.rows.forEach(t => console.log(' -', t.table_name))
    c.end()
  })
  .catch(e => console.log('Error:', e.message))