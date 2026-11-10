const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { initSchema } = require('./schema');

let sqliteDb = null;
let pgPool = null;

const isPg = !!process.env.DATABASE_URL;

function getDbInstance() {
  if (isPg) {
    if (!pgPool) {
      let connStr = process.env.DATABASE_URL;
      if (connStr && connStr.includes('sslmode=require') && !connStr.includes('uselibpqcompat')) {
        connStr = connStr.replace('sslmode=require', 'sslmode=require&uselibpqcompat=true');
      }
      pgPool = new Pool({
        connectionString: connStr,
        ssl: {
          rejectUnauthorized: false 
        },
        connectionTimeoutMillis: 15000,
        idleTimeoutMillis: 30000,
        max: 10,
        keepAlive: true
      });
      pgPool.on('error', (err) => {
        console.error('[DB Pool Error]', err.message);
      });
    }
    return pgPool;
  } else {
    if (!sqliteDb) {
      const Database = require('better-sqlite3');
      const dir = path.dirname(path.resolve(config.dbPath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      sqliteDb = new Database(path.resolve(config.dbPath));
      sqliteDb.pragma('journal_mode = WAL');
      sqliteDb.pragma('foreign_keys = ON');
    }
    return sqliteDb;
  }
}

function convertSql(sql) {
  if (!isPg) return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

async function executeWithRetry(fn, retries = 1, delayMs = 600) {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0 && (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === '57P01')) {
      await new Promise(r => setTimeout(r, delayMs));
      return executeWithRetry(fn, retries - 1, delayMs * 2);
    }
    throw err;
  }
}

async function connectAndInit() {
  getDbInstance();
  if (isPg) {
    await initSchema({ query: (sql, params) => pgPool.query(convertSql(sql), params) }, true);
  } else {
    await initSchema(sqliteDb, false);
  }
}

async function query(sql, params = []) {
  const db = getDbInstance();
  if (isPg) {
    return executeWithRetry(async () => {
      const res = await db.query(convertSql(sql), params);
      return res.rows;
    });
  } else {
    return db.prepare(sql).all(...params);
  }
}

async function queryOne(sql, params = []) {
  const db = getDbInstance();
  if (isPg) {
    return executeWithRetry(async () => {
      const res = await db.query(convertSql(sql), params);
      return res.rows[0] || null;
    });
  } else {
    return db.prepare(sql).get(...params) || null;
  }
}

async function run(sql, params = []) {
  const db = getDbInstance();
  if (isPg) {
    return executeWithRetry(async () => {
      const trimmed = sql.trim();
      const isInsert = trimmed.toUpperCase().startsWith('INSERT');
      const hasReturning = /RETURNING/i.test(trimmed);
      if (isInsert && !hasReturning) {
        try {
          const pgSql = convertSql(trimmed.replace(/;?\s*$/, '')) + ' RETURNING id';
          const res = await db.query(pgSql, params);
          return {
            lastInsertRowid: res.rows && res.rows[0] && res.rows[0].id !== undefined ? res.rows[0].id : null,
            changes: res.rowCount
          };
        } catch (err) {
          if (err.message && err.message.includes('column "id" does not exist')) {
            const pgSql = convertSql(trimmed);
            const res = await db.query(pgSql, params);
            return {
              lastInsertRowid: null,
              changes: res.rowCount
            };
          }
          throw err;
        }
      } else {
        const pgSql = convertSql(trimmed);
        const res = await db.query(pgSql, params);
        return {
          lastInsertRowid: (res.rows && res.rows[0] && res.rows[0].id !== undefined) ? res.rows[0].id : null,
          changes: res.rowCount
        };
      }
    });
  } else {
    const res = db.prepare(sql).run(...params);
    return {
      lastInsertRowid: res.lastInsertRowid,
      changes: res.changes
    };
  }
}

async function transaction(callback) {
  if (isPg) {
    return executeWithRetry(async () => {
      const client = await getDbInstance().connect();
      try {
        await client.query('BEGIN');
        const txDb = {
          query: async (sql, params = []) => {
            const res = await client.query(convertSql(sql), params);
            return res.rows;
          },
          queryOne: async (sql, params = []) => {
            const res = await client.query(convertSql(sql), params);
            return res.rows[0] || null;
          },
          run: async (sql, params = []) => {
            const trimmed = sql.trim();
            const isInsert = trimmed.toUpperCase().startsWith('INSERT');
            const hasReturning = /RETURNING/i.test(trimmed);
            if (isInsert && !hasReturning) {
              try {
                const pgSql = convertSql(trimmed.replace(/;?\s*$/, '')) + ' RETURNING id';
                const res = await client.query(pgSql, params);
                return {
                  lastInsertRowid: res.rows && res.rows[0] && res.rows[0].id !== undefined ? res.rows[0].id : null,
                  changes: res.rowCount
                };
              } catch (err) {
                if (err.message && err.message.includes('column "id" does not exist')) {
                  const pgSql = convertSql(trimmed);
                  const res = await client.query(pgSql, params);
                  return {
                    lastInsertRowid: null,
                    changes: res.rowCount
                  };
                }
                throw err;
              }
            } else {
              const pgSql = convertSql(trimmed);
              const res = await client.query(pgSql, params);
              return {
                lastInsertRowid: (res.rows && res.rows[0] && res.rows[0].id !== undefined) ? res.rows[0].id : null,
                changes: res.rowCount
              };
            }
          }
        };
        const res = await callback(txDb);
        await client.query('COMMIT');
        return res;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    });
  } else {
    const db = getDbInstance();
    
    try {
      db.prepare('BEGIN TRANSACTION').run();
      const txDb = {
        query: async (sql, params = []) => db.prepare(sql).all(...params),
        queryOne: async (sql, params = []) => db.prepare(sql).get(...params) || null,
        run: async (sql, params = []) => {
          const res = db.prepare(sql).run(...params);
          return { lastInsertRowid: res.lastInsertRowid, changes: res.changes };
        }
      };
      const res = await callback(txDb);
      db.prepare('COMMIT').run();
      return res;
    } catch (err) {
      try {
        db.prepare('ROLLBACK').run();
      } catch (_) {}
      throw err;
    }
  }
}

async function closeDb() {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}

module.exports = {
  isPg,
  query,
  queryOne,
  run,
  transaction,
  closeDb,
  getDbInstance,
  connectAndInit
};
