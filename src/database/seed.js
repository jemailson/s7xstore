const bcrypt = require('bcryptjs');
const config = require('../config');
const db = require('./db');

async function seed() {
  try {
    await db.connectAndInit();

    const existing = await db.queryOne('SELECT id FROM users WHERE role = ?', [config.roles.OWNER]);
    if (existing) {
      console.log('Owner já existe. Seed ignorado.');
      await db.closeDb();
      return;
    }

    const hash = bcrypt.hashSync(config.owner.password, 10);
    await db.run(`
      INSERT INTO users (username, password_hash, role, status, credits)
      VALUES (?, ?, ?, 'active', 999999)
    `, [config.owner.username, hash, config.roles.OWNER]);

    console.log(`Owner criado: ${config.owner.username}`);
  } catch (err) {
    console.error('Erro ao executar o seed:', err);
  } finally {
    await db.closeDb();
  }
}

seed();
