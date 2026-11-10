const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database/db');
const config = require('../config');
const { sanitizeUser, nowLocal } = require('../utils/helpers');
const logService = require('./logService');

async function findByUsername(username) {
  if (!username) return null;
  return db.queryOne('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username.trim()]);
}

async function findById(id) {
  return db.queryOne('SELECT * FROM users WHERE id = ?', [id]);
}

async function getManagedUserIds(adminId) {
  const rows = await db.query('SELECT id FROM users WHERE parent_id = ?', [adminId]);
  return rows.map((r) => r.id);
}

async function getDescendantIds(userId) {
  const result = [];
  const queue = [userId];

  while (queue.length > 0) {
    const current = queue.shift();
    const children = await db.query('SELECT id FROM users WHERE parent_id = ?', [current]);
    for (const child of children) {
      result.push(child.id);
      queue.push(child.id);
    }
  }

  return result;
}

async function authenticate(username, password, deviceId) {
  const user = await findByUsername(username);
  if (!user) return null;
  if (user.status !== 'active') {
    throw new Error('Conta inativa ou suspensa');
  }
  if (!bcrypt.compareSync(password, user.password_hash)) return null;

  if (deviceId && user.role !== config.roles.OWNER) {
    if (!user.device_id) {
      await db.run('UPDATE users SET device_id = ? WHERE id = ?', [deviceId, user.id]);
      user.device_id = deviceId;
    } else if (user.device_id !== deviceId) {
      await db.run("UPDATE users SET status = 'suspended' WHERE id = ?", [user.id]);
      await logService.createLog({
        userId: user.id,
        username: user.username,
        action: 'device_lock_block',
        details: { message: 'Conta bloqueada por tentativa de login em outro dispositivo', attempted_device: deviceId }
      });
      throw new Error('Conta bloqueada por tentativa de acesso em outro dispositivo');
    }
  }

  return sanitizeUser(user);
}

async function resetUserDevice(userId, actor) {
  if (actor.role !== config.roles.OWNER) {
    throw new Error('Somente o OWNER pode resetar o dispositivo');
  }
  const user = await findById(userId);
  if (!user) throw new Error('Usuário não encontrado');

  await db.run("UPDATE users SET device_id = NULL, status = 'active' WHERE id = ?", [userId]);

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: 'user_device_reset',
    details: {
      target_user: user.username,
      target_id: userId
    }
  });

  return sanitizeUser(await findById(userId));
}

async function createUser({ username, password, role, resellerType = null, credits = 0, parentId = null, actor }) {
  if (await findByUsername(username)) {
    throw new Error('Usuário já existe');
  }

  if (role === config.roles.OWNER) {
    throw new Error('Não é permitido criar outro owner');
  }

  if (role === config.roles.RESELLER && !Object.values(config.resellerTypes).includes(resellerType)) {
    throw new Error('Tipo de revendedor inválido');
  }

  if (role !== config.roles.RESELLER) {
    resellerType = null;
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = await db.run(`
    INSERT INTO users (username, password_hash, role, reseller_type, status, credits, parent_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `, [username, hash, role, resellerType, credits, parentId, nowLocal(), nowLocal()]);

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: 'profile_created',
    details: {
      created_user: username,
      role,
      reseller_type: resellerType,
      credits
    }
  });

  return sanitizeUser(await findById(result.lastInsertRowid));
}

async function updateCredits(userId, amount, actor, reason = 'credits_change') {
  const user = await findById(userId);
  if (!user) throw new Error('Usuário não encontrado');

  const currentCredits = parseFloat(user.credits || 0);
  const addAmount = parseFloat(amount || 0);
  const newCredits = parseFloat((currentCredits + addAmount).toFixed(2));
  if (newCredits < 0) throw new Error('Créditos insuficientes');

  let newRole = user.role;
  let newResellerType = user.reseller_type;
  if (user.role === config.roles.MEMBER && newCredits > 0) {
    newRole = config.roles.RESELLER;
    newResellerType = config.resellerTypes.CLASSIC;
    await logService.createLog({
      userId: user.id,
      username: user.username,
      action: 'user_promoted_to_reseller',
      details: {
        reason: 'credits_added',
        previous_role: config.roles.MEMBER,
        new_role: config.roles.RESELLER
      }
    });
  }

  await db.run(`
    UPDATE users SET credits = ?, role = ?, reseller_type = ?, updated_at = ? WHERE id = ?
  `, [newCredits, newRole, newResellerType, nowLocal(), userId]);

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: reason,
    details: {
      target_user: user.username,
      target_id: userId,
      change: amount,
      previous: user.credits,
      current: newCredits
    }
  });

  return sanitizeUser(await findById(userId));
}

async function setCredits(userId, credits, actor) {
  const user = await findById(userId);
  if (!user) throw new Error('Usuário não encontrado');
  const newCredits = parseFloat((parseFloat(credits || 0)).toFixed(2));
  if (newCredits < 0) throw new Error('Créditos inválidos');

  const previous = parseFloat(user.credits || 0);

  let newRole = user.role;
  let newResellerType = user.reseller_type;
  if (user.role === config.roles.MEMBER && newCredits > 0) {
    newRole = config.roles.RESELLER;
    newResellerType = config.resellerTypes.CLASSIC;
    await logService.createLog({
      userId: user.id,
      username: user.username,
      action: 'user_promoted_to_reseller',
      details: {
        reason: 'credits_set',
        previous_role: config.roles.MEMBER,
        new_role: config.roles.RESELLER
      }
    });
  }

  await db.run(`
    UPDATE users SET credits = ?, role = ?, reseller_type = ?, updated_at = ? WHERE id = ?
  `, [newCredits, newRole, newResellerType, nowLocal(), userId]);

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: 'credits_set',
    details: {
      target_user: user.username,
      target_id: userId,
      previous,
      current: credits
    }
  });

  return sanitizeUser(await findById(userId));
}

async function updateStatus(userId, status, actor) {
  const user = await findById(userId);
  if (!user) throw new Error('Usuário não encontrado');
  if (user.role === config.roles.OWNER) throw new Error('Não é permitido alterar o owner');

  const allowed = ['active', 'inactive', 'suspended'];
  if (!allowed.includes(status)) throw new Error('Status inválido');

  await db.run(`
    UPDATE users SET status = ?, updated_at = ? WHERE id = ?
  `, [status, nowLocal(), userId]);

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: 'profile_status_changed',
    details: {
      target_user: user.username,
      previous: user.status,
      current: status
    }
  });

  return sanitizeUser(await findById(userId));
}

async function updateProfile(userId, data, actor) {
  const user = await findById(userId);
  if (!user) throw new Error('Usuário não encontrado');
  if (user.role === config.roles.OWNER && actor?.id !== userId) {
    throw new Error('Não é permitido alterar o owner');
  }

  const fields = [];
  const values = [];

  if (data.password) {
    fields.push('password_hash = ?');
    values.push(bcrypt.hashSync(data.password, 10));
  }

  if (data.resellerType && user.role === config.roles.RESELLER) {
    if (!Object.values(config.resellerTypes).includes(data.resellerType)) {
      throw new Error('Tipo de revendedor inválido');
    }
    fields.push('reseller_type = ?');
    values.push(data.resellerType);
  }

  const currentResellerType = data.resellerType || user.reseller_type;
  if (data.customPrefix !== undefined) {
    if (user.role === config.roles.RESELLER && currentResellerType === config.resellerTypes.RUBI) {
      let prefixToSave = null;
      if (data.customPrefix && data.customPrefix.trim() !== '') {
        prefixToSave = String(data.customPrefix).trim().toUpperCase();
        if (prefixToSave.length !== 3 || !/^[A-Z0-9]{3}$/.test(prefixToSave)) {
          throw new Error('O prefixo do revendedor Rubi deve conter exatamente 3 letras ou números');
        }
      }
      fields.push('custom_prefix = ?');
      values.push(prefixToSave);
    } else if (data.customPrefix !== null && data.customPrefix !== '') {
      throw new Error('Somente revendedores do tipo Rubi podem ter prefixo customizado');
    }
  }

  if (data.displayName !== undefined) {
    fields.push('display_name = ?');
    values.push(data.displayName ? String(data.displayName).trim() : null);
  }

  if (data.avatarUrl !== undefined) {
    fields.push('avatar_url = ?');
    values.push(data.avatarUrl ? String(data.avatarUrl).trim() : null);
  }

  if (fields.length === 0) throw new Error('Nenhuma alteração informada');

  fields.push('updated_at = ?');
  values.push(nowLocal());
  values.push(userId);

  await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: 'profile_updated',
    details: {
      target_user: user.username,
      changes: Object.keys(data)
    }
  });

  return sanitizeUser(await findById(userId));
}

async function getKeyStatsForUser(userId) {
  const rows = await db.query(`
    SELECT status, COUNT(*) as count FROM keys WHERE user_id = ? GROUP BY status
  `, [userId]);

  const stats = {
    total: 0,
    awaiting_activation: 0,
    active: 0,
    paused: 0,
    expired: 0,
    deactivated: 0
  };

  for (const row of rows) {
    const cnt = parseInt(row.count || row.COUNT || 0, 10);
    stats[row.status] = cnt;
    stats.total += cnt;
  }

  return stats;
}

async function listProfiles({ actor, search = '', limit = 2000, offset = 0 } = {}) {
  let sql = 'SELECT * FROM users WHERE 1=1';
  const params = [];

  if (actor.role === config.roles.RESELLER) {
    sql += ' AND id = ?';
    params.push(actor.id);
  }

  if (search) {
    sql += ' AND (LOWER(username) LIKE LOWER(?) OR LOWER(role) LIKE LOWER(?) OR LOWER(COALESCE(reseller_type, \'\')) LIKE LOWER(?) OR LOWER(status) LIKE LOWER(?))';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  sql += ` ORDER BY CASE role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'reseller' THEN 3
    WHEN 'download_admin' THEN 4
    ELSE 5
  END ASC, username ASC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const users = await db.query(sql, params);
  if (!users || users.length === 0) return [];

  const allStatsRows = await db.query(`
    SELECT user_id, status, COUNT(*) as count FROM keys GROUP BY user_id, status
  `);
  const statsByUser = {};
  for (const row of allStatsRows) {
    const uid = row.user_id;
    if (!statsByUser[uid]) {
      statsByUser[uid] = {
        total: 0,
        awaiting_activation: 0,
        active: 0,
        paused: 0,
        expired: 0,
        deactivated: 0
      };
    }
    const cnt = parseInt(row.count || row.COUNT || 0, 10);
    statsByUser[uid][row.status] = cnt;
    statsByUser[uid].total += cnt;
  }

  const latestKeysRows = await db.query(`
    SELECT user_id, device_id, device_info, activation_ip, activated_at
    FROM keys
    WHERE device_id IS NOT NULL
    ORDER BY activated_at ASC
  `);
  const latestByUser = {};
  for (const row of latestKeysRows) {
    latestByUser[row.user_id] = row;
  }

  const profilesWithStats = [];
  for (const user of users) {
    const stats = statsByUser[user.id] || {
      total: 0,
      awaiting_activation: 0,
      active: 0,
      paused: 0,
      expired: 0,
      deactivated: 0
    };
    const latestKey = latestByUser[user.id] || null;

    profilesWithStats.push({
      ...sanitizeUser(user),
      keys_created: stats.total,
      keys_active: stats.active,
      keys_expired: stats.expired,
      keys_awaiting: stats.awaiting_activation,
      keys_paused: stats.paused,
      keys_deactivated: stats.deactivated,
      last_device: latestKey?.device_info || latestKey?.device_id || null,
      last_ip: latestKey?.activation_ip || null
    });
  }

  return profilesWithStats;
}

async function deleteUser(userId, actor) {
  const user = await findById(userId);
  if (!user) throw new Error('Usuário não encontrado');
  if (user.role === config.roles.OWNER) throw new Error('Não é permitido excluir o owner');
  if (user.id === actor.id) throw new Error('Não é permitido excluir a si mesmo');

  await db.run('DELETE FROM users WHERE id = ?', [userId]);

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: 'profile_deleted',
    details: {
      deleted_user: user.username,
      role: user.role
    }
  });

  return true;
}

async function canManageUser(actor, targetId) {
  if (actor.role === config.roles.OWNER) return true;
  if (actor.id === targetId) return true;

  if (actor.role === config.roles.ADMIN) {
    const target = await findById(targetId);
    if (!target) return false;
    if (target.role === config.roles.OWNER || target.role === config.roles.ADMIN) return false;
    return true;
  }

  return false;
}

module.exports = {
  findByUsername,
  findById,
  getManagedUserIds,
  getDescendantIds,
  authenticate,
  createUser,
  updateCredits,
  setCredits,
  updateStatus,
  updateProfile,
  listProfiles,
  deleteUser,
  canManageUser,
  getKeyStatsForUser,
  resetUserDevice,
  findOrCreateDiscordUser
};

async function findOrCreateDiscordUser(discordProfile) {
  const { id: discordId, username, global_name, avatar } = discordProfile;

  const existing = await db.queryOne('SELECT * FROM users WHERE discord_id = ?', [discordId]);
  if (existing) {
    const avatarUrl = avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128`
      : null;
    await db.run(
      'UPDATE users SET display_name = ?, avatar_url = ?, updated_at = ? WHERE discord_id = ?',
      [global_name || username, avatarUrl, nowLocal(), discordId]
    );
    return db.queryOne('SELECT * FROM users WHERE discord_id = ?', [discordId]);
  }

  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const newUsername = `${(username || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}_${randomSuffix}`;
  const randomPassword = crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(randomPassword, 10);
  const avatarUrl = avatar
    ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128`
    : null;

  await db.run(
    `INSERT INTO users (username, password_hash, role, reseller_type, status, credits, discord_id, display_name, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUsername,
      passwordHash,
      config.roles.MEMBER,
      null,
      'active',
      0,
      discordId,
      global_name || username,
      avatarUrl,
      nowLocal(),
      nowLocal()
    ]
  );

  await logService.createLog({
    username: newUsername,
    action: 'discord_register',
    details: { discord_id: discordId, discord_username: username }
  });

  return db.queryOne('SELECT * FROM users WHERE discord_id = ?', [discordId]);
}
