require('dotenv').config();
const { connectAndInit, getDbInstance, isPg } = require('./src/database/db');

async function migrate() {
  await connectAndInit();
  const db = getDbInstance();
  
  console.log('Starting migration...');
  
  try {
    if (isPg) {
      console.log('Running PostgreSQL migrations...');
      
      await db.query(`ALTER TABLE users ALTER COLUMN credits TYPE DECIMAL(10,2);`);
      
      await db.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          amount DECIMAL(10,2) NOT NULL,
          credits DECIMAL(10,2) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          payment_id VARCHAR(255),
          external_reference VARCHAR(255) UNIQUE,
          qr_code TEXT,
          qr_code_base64 TEXT,
          ticket_url TEXT,
          created_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
          updated_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        );
      `);
      
      await db.query(`
        CREATE TABLE IF NOT EXISTS downloads (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          platform_type VARCHAR(100) NOT NULL,
          version VARCHAR(100),
          download_url TEXT NOT NULL,
          public_url TEXT,
          created_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
          updated_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        );
      `);
      
      await db.query(`ALTER TABLE keys ALTER COLUMN duration_days TYPE DECIMAL(10,2);`);
      await db.query(`ALTER TABLE key_reservoir ALTER COLUMN duration_days TYPE DECIMAL(10,2);`);
      
    } else {
      console.log('Running SQLite migrations...');
      
      db.prepare(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          amount REAL NOT NULL,
          credits REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          payment_id TEXT,
          external_reference TEXT UNIQUE,
          qr_code TEXT,
          qr_code_base64 TEXT,
          ticket_url TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );
      `).run();
      
      db.prepare(`
        CREATE TABLE IF NOT EXISTS downloads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          platform_type TEXT NOT NULL,
          version TEXT,
          download_url TEXT NOT NULL,
          public_url TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );
      `).run();
    }
    console.log('Migration completed successfully!');
  } catch (e) {
    console.error('Migration failed:', e);
  }
  
  process.exit(0);
}

migrate();
