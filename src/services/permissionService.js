const db = require('../database/db');
const { nowLocal } = require('../utils/helpers');
const logService = require('./logService');
const config = require('../config');

async function fetchDiscordUserInfo(discordId) {
  const token = config.discordBotToken;
  let username = null;
  let globalName = null;
  let avatar = null;
  let avatarUrl = null;
  let banner = null;
  let bannerUrl = null;
  let accentColor = null;

  try {
    const res = await fetch(`https://discord.com/api/v10/users/${discordId}`, {
      headers: { Authorization: `Bot ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      username    = data.username    || null;
      globalName  = data.global_name || null;
      avatar      = data.avatar      || null;
      banner      = data.banner      || null;
      accentColor = data.accent_color || null;

      if (avatar) {
        const ext = avatar.startsWith('a_') ? 'gif' : 'png';
        avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${ext}?size=128`;
      }

      if (banner) {
        const ext = banner.startsWith('a_') ? 'gif' : 'png';
        bannerUrl = `https://cdn.discordapp.com/banners/${discordId}/${banner}.${ext}?size=480`;
      }
    }
  } catch (err) {
    console.error(`[Discord API] Erro ao buscar info do ID ${discordId}:`, err.message);
  }

  if (!avatarUrl) {
    try {
      const defaultIndex = Number((BigInt(discordId) >> 22n) % 6n);
      avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    } catch (_) {
      avatarUrl = `https://cdn.discordapp.com/embed/avatars/0.png`;
    }
  }

  return { username, globalName, avatar, avatarUrl, banner, bannerUrl, accentColor };
}

async function listPermissions() {
  const rows = await db.query('SELECT * FROM discord_permissions ORDER BY id DESC');

  const list = [];
  for (const perm of rows) {
    const cntRow = await db.queryOne('SELECT COUNT(*) as total FROM key_reservoir WHERE used_by = ?', [perm.discord_id]);
    const total = cntRow ? parseInt(cntRow.total || cntRow.count || 0, 10) : 0;

    const latestKey = await db.queryOne(`
      SELECT key_code, platform, duration_days, used_at
      FROM key_reservoir
      WHERE used_by = ?
      ORDER BY used_at DESC
      LIMIT 1
    `, [perm.discord_id]);

    list.push({
      ...perm,
      keys_generated: total,
      last_key: latestKey ? `${latestKey.key_code} (${latestKey.platform.toUpperCase()} - ${latestKey.duration_days}d)` : null,
      last_key_at: latestKey ? latestKey.used_at : null
    });
  }

  return list;
}

async function addPermission({ discordId, name, actor }) {
  if (!discordId) throw new Error('ID do Discord é obrigatório');

  const discordInfo = await fetchDiscordUserInfo(discordId);

  const existing = await db.queryOne('SELECT * FROM discord_permissions WHERE discord_id = ?', [discordId]);
  if (existing) {
    if (existing.status === 'active') {
      throw new Error('Este ID do Discord já está autorizado');
    }
    await db.run(`
      UPDATE discord_permissions
      SET status = 'active',
          name = ?,
          username = ?,
          global_name = ?,
          avatar = ?,
          avatar_url = ?,
          banner = ?,
          banner_url = ?,
          accent_color = ?,
          created_at = ?
      WHERE id = ?
    `, [
      name || existing.name,
      discordInfo.username    || existing.username,
      discordInfo.globalName  || existing.global_name,
      discordInfo.avatar      || existing.avatar,
      discordInfo.avatarUrl   || existing.avatar_url,
      discordInfo.banner      || existing.banner,
      discordInfo.bannerUrl   || existing.banner_url,
      discordInfo.accentColor ?? existing.accent_color,
      nowLocal(),
      existing.id
    ]);
  } else {
    await db.run(`
      INSERT INTO discord_permissions
        (discord_id, name, username, global_name, avatar, avatar_url, banner, banner_url, accent_color, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `, [
      discordId,
      name || null,
      discordInfo.username,
      discordInfo.globalName,
      discordInfo.avatar,
      discordInfo.avatarUrl,
      discordInfo.banner,
      discordInfo.bannerUrl,
      discordInfo.accentColor,
      nowLocal()
    ]);
  }

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: 'discord_permission_added',
    details: {
      discord_id: discordId,
      name,
      discord_tag: discordInfo.username ? `@${discordInfo.username}` : null
    }
  });

  return true;
}

async function deletePermission(id, actor) {
  const perm = await db.queryOne('SELECT * FROM discord_permissions WHERE id = ?', [id]);
  if (!perm) throw new Error('Permissão não encontrada');

  await db.run('DELETE FROM discord_permissions WHERE id = ?', [id]);

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: 'discord_permission_removed',
    details: { discord_id: perm.discord_id, name: perm.name }
  });

  return true;
}

async function isAuthorized(discordId) {
  const perm = await db.queryOne("SELECT * FROM discord_permissions WHERE discord_id = ? AND status = 'active'", [discordId]);
  return !!perm;
}

module.exports = { listPermissions, addPermission, deletePermission, isAuthorized };
