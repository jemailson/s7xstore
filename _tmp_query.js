require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
(async () => {
  const keys = await pool.query('SELECT key_code, status, duration_days, device_id, user_id FROM keys ORDER BY id DESC LIMIT 15');
  console.log('KEYS:', JSON.stringify(keys.rows, null, 2));
  const users = await pool.query('SELECT id, username, role, reseller_type, custom_prefix, credits, status FROM users ORDER BY id LIMIT 30');
  console.log('USERS:', JSON.stringify(users.rows, null, 2));
  const cnt = await pool.query('SELECT count(*)::int as c FROM keys');
  console.log('KEY COUNT:', cnt.rows[0].c);
  await pool.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
