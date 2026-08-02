const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  const h = await bcrypt.hash('TestNewUser!', 10);
  const r = await p.query(
    `INSERT INTO users(email, password_hash, full_name, role, provider, verified_isk)
     VALUES($1, $2, $3, $4, $5, true)
     ON CONFLICT(email) DO UPDATE SET password_hash = EXCLUDED.password_hash, verified_isk = true
     RETURNING id, email, role`,
    ['newuser-test@metardu.test', h, 'New Test User', 'user', 'credentials']
  );
  console.log('OK', JSON.stringify(r.rows[0]));
  await p.end();
})().catch(e => {
  console.error('ERR', e.message);
  process.exit(1);
});
