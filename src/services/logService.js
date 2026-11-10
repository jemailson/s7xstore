const db = require('../database/db');
const { nowLocal } = require('../utils/helpers');

async function createLog({ userId = null, username = null, action, keyId = null, keyCode = null, details = null, ipAddress = null }) {
  const result = await db.run(`
    INSERT INTO logs (user_id, username, action, key_id, key_code, details, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    userId,
    username,
    action,
    keyId,
    keyCode,
    typeof details === 'object' ? JSON.stringify(details) : details,
    ipAddress,
    nowLocal()
  ]);
  return result.lastInsertRowid;
}

async function getLogs({ userId, role, managedUserIds = [], limit = 100, offset = 0, search = '', filterUserId = null } = {}) {
  let sql = 'SELECT * FROM logs WHERE 1=1';
  const params = [];

  // Se filterUserId fornecido e quem chama é owner/admin, filtra por usuário específico
  if (filterUserId && (role === 'owner' || role === 'admin')) {
    sql += ' AND user_id = ?';
    params.push(filterUserId);
  } else if (role === 'admin' && managedUserIds.length > 0) {
    const placeholders = managedUserIds.map(() => '?').join(',');
    sql += ` AND (user_id IN (${placeholders}) OR user_id = ?)`;
    params.push(...managedUserIds, userId);
  } else if (role === 'reseller') {
    sql += ' AND user_id = ?';
    params.push(userId);
  }

  if (search) {
    sql += ' AND (action LIKE ? OR key_code LIKE ? OR username LIKE ? OR details LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.query(sql, params);
}

async function getLogsCount({ userId, role, managedUserIds = [], search = '', filterUserId = null } = {}) {
  let sql = 'SELECT COUNT(*) as total FROM logs WHERE 1=1';
  const params = [];

  if (filterUserId && (role === 'owner' || role === 'admin')) {
    sql += ' AND user_id = ?';
    params.push(filterUserId);
  } else if (role === 'admin' && managedUserIds.length > 0) {
    const placeholders = managedUserIds.map(() => '?').join(',');
    sql += ` AND (user_id IN (${placeholders}) OR user_id = ?)`;
    params.push(...managedUserIds, userId);
  } else if (role === 'reseller') {
    sql += ' AND user_id = ?';
    params.push(userId);
  }

  if (search) {
    sql += ' AND (action LIKE ? OR key_code LIKE ? OR username LIKE ? OR details LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  const row = await db.queryOne(sql, params);
  return row ? parseInt(row.total || row.count || 0, 10) : 0;
}

module.exports = { createLog, getLogs, getLogsCount };
