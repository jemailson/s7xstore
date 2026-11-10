const db = require('../database/db');
const config = require('../config');
const {
  generateKeyCode,
  nowLocal,
  addDays,
  isExpired,
  statusLabel
} = require('../utils/helpers');
const logService = require('./logService');
const userService = require('./userService');

async function findByCode(keyCode) {
  return db.queryOne('SELECT * FROM keys WHERE key_code = ?', [keyCode]);
}

async function findById(id) {
  return db.queryOne('SELECT * FROM keys WHERE id = ?', [id]);
}

async function expireIfNeeded(key) {
  if (!key) return key;
  if (key.status === config.keyStatus.ACTIVE && isExpired(key.expires_at)) {
    await db.run(`
      UPDATE keys SET status = ?, updated_at = ? WHERE id = ?
    `, [config.keyStatus.EXPIRED, nowLocal(), key.id]);

    await logService.createLog({
      action: 'key_expired',
      keyId: key.id,
      keyCode: key.key_code,
      details: { expires_at: key.expires_at }
    });

    return findById(key.id);
  }
  return key;
}

function getCreditCost(durationDays) {
  const d = parseFloat(durationDays);
  if (d <= 0.05) return 0.2;
  if (d <= 1) return 1.0;
  if (d <= 3) return 1.5;
  if (d <= 7) return 2.0;
  if (d <= 15) return 3.0;
  if (d <= 30) return 4.0;
  return 12.0;
}

async function createKeys({ userId, quantity = 1, durationDays = 30, prefix = 'S7X-XXX', actor, ipAddress = null }) {
  const owner = await userService.findById(userId);
  if (!owner) throw new Error('Usuário não encontrado');

  let finalPrefix = 'S7X-XXX';
  if (owner.role === config.roles.RESELLER) {
    if (owner.reseller_type === config.resellerTypes.CLASSIC) {
      finalPrefix = 'S7X-XXX';
    } else if (owner.reseller_type === config.resellerTypes.RUBI) {
      if (owner.custom_prefix && owner.custom_prefix !== 'S7X-XXX') {
        const cleaned = String(owner.custom_prefix).trim().toUpperCase();
        if (cleaned.length === 3 && /^[A-Z0-9]{3}$/.test(cleaned)) {
          finalPrefix = cleaned;
        }
      }
    }
  } else {
    if (prefix) {
      const cleaned = String(prefix).trim().toUpperCase();
      if (cleaned.length === 3 && /^[A-Z0-9]{3}$/.test(cleaned)) {
        finalPrefix = cleaned;
      }
    }
  }

  const costPerKey = getCreditCost(durationDays);
  const totalCost = costPerKey * quantity;

  if (owner.role === config.roles.RESELLER && owner.credits < totalCost) {
    throw new Error('Créditos insuficientes');
  }

  if (quantity < 1 || quantity > 100) {
    throw new Error('Quantidade inválida (1-100)');
  }

  if (durationDays <= 0) {
    throw new Error('Duração inválida');
  }

  const created = [];

  await db.transaction(async (tx) => {
    if (owner.role === config.roles.RESELLER) {
      
      const targetUser = await tx.queryOne('SELECT credits FROM users WHERE id = ?', [userId]);
      const newCredits = parseFloat((parseFloat(targetUser.credits) - totalCost).toFixed(2));
      if (newCredits < 0) throw new Error('Créditos insuficientes');
      
      await tx.run('UPDATE users SET credits = ?, updated_at = ? WHERE id = ?', [newCredits, nowLocal(), userId]);
      
      await tx.run(`
        INSERT INTO logs (user_id, username, action, details, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [
        actor?.id,
        actor?.username,
        'credits_key_generation',
        JSON.stringify({
          target_user: owner.username,
          target_id: userId,
          change: -totalCost,
          previous: targetUser.credits,
          current: newCredits
        }),
        nowLocal()
      ]);
    }

    for (let i = 0; i < quantity; i++) {
      let code;
      let existing;
      do {
        code = generateKeyCode(finalPrefix);
        existing = await tx.queryOne('SELECT id FROM keys WHERE key_code = ?', [code]);
      } while (existing);

      const now = nowLocal();
      const expiresAt = addDays(now, durationDays);
      const result = await tx.run(`
        INSERT INTO keys (key_code, user_id, status, duration_days, activated_at, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [code, userId, config.keyStatus.ACTIVE, durationDays, now, expiresAt, now, now]);

      const key = await tx.queryOne('SELECT * FROM keys WHERE id = ?', [result.lastInsertRowid]);
      created.push(key);

      await tx.run(`
        INSERT INTO logs (user_id, username, action, key_id, key_code, details, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        actor?.id,
        actor?.username,
        'key_created',
        key.id,
        key.key_code,
        JSON.stringify({
          duration_days: durationDays,
          owner: owner.username
        }),
        ipAddress,
        nowLocal()
      ]);
    }
  });

  return created;
}

async function listKeys({ actor, search = '', status = '', limit = 50, offset = 0 } = {}) {
  let sql = `
    SELECT k.*, u.username as owner_username, u.role as owner_role
    FROM keys k
    JOIN users u ON u.id = k.user_id
    WHERE 1=1
  `;
  const params = [];

  if (actor.role === config.roles.RESELLER) {
    sql += ' AND k.user_id = ?';
    params.push(actor.id);
  } else if (actor.role === config.roles.ADMIN) {
    const managed = await userService.getManagedUserIds(actor.id);
    const ids = [actor.id, ...managed];
    sql += ` AND k.user_id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }

  if (status) {
    sql += ' AND k.status = ?';
    params.push(status);
  }

  if (search) {
    const term = `%${search}%`;
    sql += ` AND (
      k.key_code LIKE ? OR
      k.status LIKE ? OR
      k.created_at LIKE ? OR
      k.activated_at LIKE ? OR
      k.expires_at LIKE ? OR
      CAST(k.duration_days AS TEXT) LIKE ? OR
      COALESCE(k.device_id, '') LIKE ? OR
      COALESCE(k.activation_ip, '') LIKE ? OR
      u.username LIKE ?
    )`;
    params.push(term, term, term, term, term, term, term, term, term);
  }

  sql += ' ORDER BY k.id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const keys = await db.query(sql, params);

  const processedKeys = [];
  for (let key of keys) {
    key = await expireIfNeeded(key);
    processedKeys.push({
      ...key,
      status_label: statusLabel(key.status)
    });
  }

  return processedKeys;
}

async function countKeys({ actor, search = '', status = '' } = {}) {
  let sql = `
    SELECT COUNT(*) as total
    FROM keys k
    JOIN users u ON u.id = k.user_id
    WHERE 1=1
  `;
  const params = [];

  if (actor.role === config.roles.RESELLER) {
    sql += ' AND k.user_id = ?';
    params.push(actor.id);
  } else if (actor.role === config.roles.ADMIN) {
    const managed = await userService.getManagedUserIds(actor.id);
    const ids = [actor.id, ...managed];
    sql += ` AND k.user_id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }

  if (status) {
    sql += ' AND k.status = ?';
    params.push(status);
  }

  if (search) {
    const term = `%${search}%`;
    sql += ` AND (
      k.key_code LIKE ? OR
      k.status LIKE ? OR
      k.created_at LIKE ? OR
      k.activated_at LIKE ? OR
      k.expires_at LIKE ? OR
      CAST(k.duration_days AS VARCHAR) LIKE ? OR
      COALESCE(k.device_id, '') LIKE ? OR
      COALESCE(k.activation_ip, '') LIKE ? OR
      u.username LIKE ?
    )`;
    params.push(term, term, term, term, term, term, term, term, term);
  }

  const row = await db.queryOne(sql, params);
  return row ? parseInt(row.total || row.count || 0, 10) : 0;
}

async function canAccessKey(actor, key) {
  if (!key) return false;
  if (actor.role === config.roles.OWNER) return true;
  if (actor.role === config.roles.RESELLER) return key.user_id === actor.id;
  if (actor.role === config.roles.ADMIN) {
    if (key.user_id === actor.id) return true;
    const managed = await userService.getManagedUserIds(actor.id);
    return managed.includes(key.user_id);
  }
  return false;
}

async function pauseKey(keyId, actor, ipAddress = null) {
  const key = await expireIfNeeded(await findById(keyId));
  if (!key) throw new Error('Key não encontrada');
  if (!(await canAccessKey(actor, key))) throw new Error('Sem permissão');
  if (key.status !== config.keyStatus.ACTIVE && key.status !== config.keyStatus.AWAITING) {
    throw new Error('Somente keys ativas ou aguardando ativação podem ser pausadas');
  }

  await db.run(`
    UPDATE keys SET status = ?, updated_at = ? WHERE id = ?
  `, [config.keyStatus.PAUSED, nowLocal(), keyId]);

  await logService.createLog({
    userId: actor.id,
    username: actor.username,
    action: 'key_paused',
    keyId: key.id,
    keyCode: key.key_code,
    details: { previous_status: key.status },
    ipAddress
  });

  return findById(keyId);
}

async function resumeKey(keyId, actor, ipAddress = null) {
  const key = await findById(keyId);
  if (!key) throw new Error('Key não encontrada');
  if (!(await canAccessKey(actor, key))) throw new Error('Sem permissão');
  if (key.status !== config.keyStatus.PAUSED) {
    throw new Error('Somente keys pausadas podem ser retomadas');
  }

  let newStatus = config.keyStatus.AWAITING;
  if (key.device_id && key.expires_at) {
    newStatus = isExpired(key.expires_at) ? config.keyStatus.EXPIRED : config.keyStatus.ACTIVE;
  }

  await db.run(`
    UPDATE keys SET status = ?, updated_at = ? WHERE id = ?
  `, [newStatus, nowLocal(), keyId]);

  await logService.createLog({
    userId: actor.id,
    username: actor.username,
    action: 'key_resumed',
    keyId: key.id,
    keyCode: key.key_code,
    details: { new_status: newStatus },
    ipAddress
  });

  return findById(keyId);
}

async function restoreKey(keyId, actor, ipAddress = null) {
  const key = await findById(keyId);
  if (!key) throw new Error('Key não encontrada');
  if (!(await canAccessKey(actor, key))) throw new Error('Sem permissão');
  if (key.status === config.keyStatus.DEACTIVATED) {
    throw new Error('Key desativada não pode ser restaurada');
  }
  if (key.status === config.keyStatus.EXPIRED) {
    throw new Error('Key expirada não pode ser restaurada');
  }

  await db.run(`
    UPDATE keys
    SET device_id = NULL,
        device_info = NULL,
        activation_ip = NULL,
        activated_at = NULL,
        expires_at = NULL,
        status = ?,
        updated_at = ?
    WHERE id = ?
  `, [config.keyStatus.AWAITING, nowLocal(), keyId]);

  await logService.createLog({
    userId: actor.id,
    username: actor.username,
    action: 'key_restored',
    keyId: key.id,
    keyCode: key.key_code,
    details: {
      previous_device: key.device_id,
      previous_ip: key.activation_ip
    },
    ipAddress
  });

  return findById(keyId);
}

async function deleteKey(keyId, actor, ipAddress = null) {
  const key = await findById(keyId);
  if (!key) throw new Error('Key não encontrada');
  if (!(await canAccessKey(actor, key))) throw new Error('Sem permissão');

  await db.run(`
    UPDATE keys SET status = ?, updated_at = ? WHERE id = ?
  `, [config.keyStatus.DEACTIVATED, nowLocal(), keyId]);

  await logService.createLog({
    userId: actor.id,
    username: actor.username,
    action: 'key_deleted',
    keyId: key.id,
    keyCode: key.key_code,
    details: {
      previous_status: key.status,
      device_id: key.device_id,
      activation_ip: key.activation_ip
    },
    ipAddress
  });

  return findById(keyId);
}

async function hardDeleteKey(keyId, actor, ipAddress = null) {
  const key = await findById(keyId);
  if (!key) throw new Error('Key não encontrada');
  if (actor.role !== config.roles.OWNER) throw new Error('Somente o owner pode excluir permanentemente');

  await db.run('DELETE FROM keys WHERE id = ?', [keyId]);

  await logService.createLog({
    userId: actor.id,
    username: actor.username,
    action: 'key_hard_deleted',
    keyCode: key.key_code,
    details: {
      previous_status: key.status
    },
    ipAddress
  });

  return true;
}

async function unbindDevice(keyId, actor, ipAddress = null) {
  return restoreKey(keyId, actor, ipAddress);
}

module.exports = {
  findByCode,
  findById,
  expireIfNeeded,
  createKeys,
  listKeys,
  countKeys,
  canAccessKey,
  pauseKey,
  resumeKey,
  restoreKey,
  deleteKey,
  hardDeleteKey,
  unbindDevice
};
