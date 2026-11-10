const db = require('../database/db');
const { nowLocal, addDays } = require('../utils/helpers');
const logService = require('./logService');

async function addBulkKeys({ platform, durationDays, keyCodes, actor }) {
  if (!platform || !platform.trim()) {
    throw new Error('Plataforma/Dispositivo é obrigatório.');
  }
  const cleanPlatform = platform.trim().toLowerCase();

  const dur = parseFloat(durationDays);
  if (!dur || isNaN(dur) || dur <= 0) {
    throw new Error('Duração inválida em dias.');
  }

  if (!Array.isArray(keyCodes) || keyCodes.length === 0) {
    throw new Error('Nenhuma key informada.');
  }

  let successCount = 0;
  let dupCount = 0;
  const duplicateList = [];
  const insertedList = [];
  const seenInBatch = new Set();

  for (let rawCode of keyCodes) {
    const code = String(rawCode || '').trim();
    if (!code) continue;

    if (seenInBatch.has(code)) {
      dupCount++;
      duplicateList.push(code);
      continue;
    }
    seenInBatch.add(code);

    try {
      const existing = await db.queryOne(
        "SELECT id, status, platform, duration_days FROM key_reservoir WHERE key_code = ?",
        [code]
      );

      if (existing) {
        if (existing.status === 'available') {
          if (String(existing.platform).toLowerCase() === cleanPlatform && Math.abs(parseFloat(existing.duration_days) - dur) < 0.001) {
            dupCount++;
            duplicateList.push(code);
            continue;
          } else {
            await db.run(
              "UPDATE key_reservoir SET platform = ?, duration_days = ?, created_at = ? WHERE id = ?",
              [cleanPlatform, dur, nowLocal(), existing.id]
            );
            successCount++;
            insertedList.push(code);
            continue;
          }
        } else {
          await db.run(
            "UPDATE key_reservoir SET platform = ?, duration_days = ?, status = 'available', used_by = NULL, used_at = NULL, created_at = ? WHERE id = ?",
            [cleanPlatform, dur, nowLocal(), existing.id]
          );
          successCount++;
          insertedList.push(code);
          continue;
        }
      }

      await db.run(`
        INSERT INTO key_reservoir (key_code, platform, duration_days, status, created_at)
        VALUES (?, ?, ?, 'available', ?)
      `, [code, cleanPlatform, dur, nowLocal()]);

      successCount++;
      insertedList.push(code);
    } catch (insertErr) {
      try {
        await db.run(`
          UPDATE key_reservoir 
          SET platform = ?, duration_days = ?, status = 'available', used_by = NULL, used_at = NULL, created_at = ?
          WHERE key_code = ?
        `, [cleanPlatform, dur, nowLocal(), code]);
        successCount++;
        insertedList.push(code);
      } catch (updateErr) {
        dupCount++;
        duplicateList.push(code);
      }
    }
  }

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: 'bulk_keys_added',
    details: {
      platform: cleanPlatform,
      duration_days: dur,
      inserted: successCount,
      duplicates: dupCount
    }
  });

  return { successCount, dupCount, duplicateList, insertedList };
}

async function getReservoirStats() {
  const platforms = await db.query("SELECT * FROM platforms WHERE status = 'active' ORDER BY id ASC");

  const stats = {};
  for (const p of platforms) {
    let parsedDurs = null;
    if (p.durations) {
      try {
        parsedDurs = typeof p.durations === 'string' ? JSON.parse(p.durations) : p.durations;
      } catch (e) {}
    }
    stats[p.slug] = {
      id: p.id,
      name: p.name,
      slug: p.slug,
      emoji: p.emoji || 'mobile',
      durations: { 1: 0, 7: 0, 30: 0 },
      configured_durations: parsedDurs || []
    };
  }

  const rows = await db.query(`
    SELECT platform, duration_days, COUNT(*) as count 
    FROM key_reservoir 
    WHERE status = 'available' 
    GROUP BY platform, duration_days
  `);

  for (const r of rows) {
    const plat = String(r.platform || '').toLowerCase();
    const dur = parseFloat(r.duration_days);
    const cnt = parseInt(r.count || r.COUNT || 0, 10);
    
    if (!stats[plat]) {
      const orphanObj = {
        id: plat,
        slug: plat,
        name: plat.toUpperCase(),
        emoji: 'mobile',
        status: 'active',
        durations: null
      };
      platforms.push(orphanObj);
      stats[plat] = {
        id: plat,
        name: plat.toUpperCase(),
        slug: plat,
        emoji: 'mobile',
        durations: { 1: 0, 7: 0, 30: 0 },
        configured_durations: []
      };
    }
    stats[plat].durations[dur] = cnt;
  }

  return { stats, platforms };
}

async function claimKey({ platform, durationDays, discordId, discordTag }) {
  const dur = parseInt(durationDays, 10);
  const cleanPlatform = String(platform || '').toLowerCase();
  
  return db.transaction(async (tx) => {
    const keyRow = await tx.queryOne(`
      SELECT * FROM key_reservoir 
      WHERE platform = ? AND duration_days = ? AND status = 'available'
      ORDER BY id ASC
      LIMIT 1
    `, [cleanPlatform, dur]);

    if (!keyRow) {
      throw new Error(`Não há keys disponíveis no reservatório para ${cleanPlatform.toUpperCase()} de ${dur} dias.`);
    }

    const now = nowLocal();
    const expiresAt = addDays(now, dur);

    await tx.run('DELETE FROM key_reservoir WHERE id = ?', [keyRow.id]);

    const owner = await tx.queryOne("SELECT id, username FROM users WHERE role = 'owner' LIMIT 1");
    const ownerId = owner ? owner.id : 1;

    const existingKey = await tx.queryOne('SELECT id FROM keys WHERE key_code = ?', [keyRow.key_code]);
    let keyId = existingKey ? existingKey.id : null;

    if (!existingKey) {
      const insertRes = await tx.run(`
        INSERT INTO keys (key_code, user_id, status, duration_days, activated_at, expires_at, created_at, updated_at)
        VALUES (?, ?, 'active', ?, ?, ?, ?, ?)
      `, [keyRow.key_code, ownerId, dur, now, expiresAt, now, now]);
      keyId = insertRes.lastInsertRowid;
    } else {
      await tx.run(`
        UPDATE keys 
        SET user_id = ?, status = 'active', duration_days = ?, activated_at = ?, expires_at = ?, updated_at = ? 
        WHERE id = ?
      `, [ownerId, dur, now, expiresAt, now, existingKey.id]);
    }

    await tx.run(`
      INSERT INTO logs (user_id, username, action, key_id, key_code, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      ownerId,
      owner ? owner.username : 'owner',
      'discord_key_generated',
      keyId,
      keyRow.key_code,
      JSON.stringify({
        platform: cleanPlatform,
        duration_days: dur,
        discord_id: discordId,
        discord_tag: discordTag
      }),
      now
    ]);

    return keyRow.key_code;
  });
}

async function listAvailableProducts(user = null) {
  let platforms = await db.query("SELECT * FROM platforms WHERE status = 'active' ORDER BY name ASC");

  if (user && user.role !== 'owner' && user.role !== 'admin') {
    const perms = await db.query(
      'SELECT platform_slug, allowed FROM user_product_permissions WHERE user_id = ?',
      [user.id]
    );
    const blockedSlugs = new Set(
      perms
        .filter(p => p.allowed === false || p.allowed === 0)
        .map(p => String(p.platform_slug).toLowerCase())
    );
    if (blockedSlugs.size > 0) {
      platforms = platforms.filter(p => !blockedSlugs.has(String(p.slug).toLowerCase()));
    }
  }

  const stockRows = await db.query(`
    SELECT platform, duration_days, COUNT(*) as count
    FROM key_reservoir
    WHERE status = 'available'
    GROUP BY platform, duration_days
  `);

  const stockMap = {};
  for (const r of stockRows) {
    const normalizedDur = parseFloat(r.duration_days);
    const key = `${String(r.platform).toLowerCase()}__${normalizedDur}`;
    stockMap[key] = parseInt(r.count || 0, 10);
  }

  const defaultDurations = [
    { days: 1, label: '1 dia', credits: 1.0 },
    { days: 7, label: '7 dias', credits: 2.0 },
    { days: 30, label: '30 dias', credits: 4.0 }
  ];

  const result = [];

  for (const p of platforms) {
    let platDurations = defaultDurations;
    if (p.durations) {
      try {
        const parsed = typeof p.durations === 'string' ? JSON.parse(p.durations) : p.durations;
        if (Array.isArray(parsed) && parsed.length > 0) {
          platDurations = parsed;
        }
      } catch (e) {}
    }

    for (const d of platDurations) {
      const durDays = parseFloat(d.days);
      let count = 0;
      for (const [key, cnt] of Object.entries(stockMap)) {
        const [plat, durStr] = key.split('__');
        if (plat === p.slug && Math.abs(parseFloat(durStr) - durDays) < 0.001) {
          count += cnt;
        }
      }

      result.push({
        platform: p.slug,
        platform_name: p.name,
        duration_days: durDays,
        duration_label: d.label || (durDays < 1 ? `${Math.round(durDays * 24)} hora(s)` : `${durDays} dia(s)`),
        credits: d.credits !== undefined ? parseFloat(d.credits) : 1.0,
        count
      });
    }
  }

  return result;
}

async function claimKeyForUser({ platform, durationDays, userId, actor, ipAddress, quantity = 1 }) {
  const cleanPlatform = String(platform || '').trim().toLowerCase();
  const dur = parseFloat(durationDays);
  const qty = parseInt(quantity, 10) || 1;
  if (!cleanPlatform) throw new Error('Produto não informado.');
  if (!dur || dur <= 0) throw new Error('Duração inválida.');
  if (qty <= 0 || qty > 100) throw new Error('Quantidade inválida (máximo 100).');

  const platformRow = await db.queryOne(
    'SELECT * FROM platforms WHERE slug = ? OR LOWER(name) = LOWER(?)',
    [cleanPlatform, cleanPlatform]
  );

  let creditCost = null;
  if (platformRow && platformRow.durations) {
    try {
      const parsed = typeof platformRow.durations === 'string' ? JSON.parse(platformRow.durations) : platformRow.durations;
      if (Array.isArray(parsed)) {
        const match = parsed.find(d => Math.abs(parseFloat(d.days) - dur) < 0.001);
        if (match && match.credits !== undefined) {
          creditCost = parseFloat(match.credits);
        }
      }
    } catch (e) {}
  }

  if (creditCost === null) {
    const CREDIT_COSTS = {
      0.0417: 0.2,
      0.05: 0.2,
      1: 1.0,
      3: 1.5,
      7: 2.0,
      15: 3.0,
      30: 4.0,
      3650: 12.0
    };
    const roundedDur = Object.keys(CREDIT_COSTS).reduce((prev, curr) =>
      Math.abs(curr - dur) < Math.abs(prev - dur) ? curr : prev
    );
    creditCost = CREDIT_COSTS[roundedDur] || 1.0;
  }
  const totalCost = creditCost * qty;

  return db.transaction(async (tx) => {
    const userRow = await tx.queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    if (!userRow) throw new Error('Usuário não encontrado.');

    // Verifica se o usuário tem permissão para este produto
    const permRow = await db.queryOne(
      'SELECT allowed FROM user_product_permissions WHERE user_id = ? AND platform_slug = ?',
      [userId, cleanPlatform]
    );
    // null = sem registro = permitido por padrão; false/0 = bloqueado
    if (permRow && (permRow.allowed === false || permRow.allowed === 0)) {
      throw new Error(`Você não tem permissão para gerar keys do produto "${cleanPlatform.toUpperCase()}".`);
    }

    if (userRow.role === 'reseller' && parseFloat(userRow.credits) < totalCost) {
      throw new Error(`Créditos insuficientes. Necessário: ${totalCost} crédito(s).`);
    }

    const keyRows = await tx.query(`
      SELECT * FROM key_reservoir
      WHERE platform = ? AND ABS(duration_days - ?) < 0.001 AND status = 'available'
      ORDER BY id ASC
      LIMIT ?
    `, [cleanPlatform, dur, qty]);

    if (keyRows.length < qty) {
      throw new Error(`Estoque insuficiente. Há apenas ${keyRows.length} key(s) disponível(is) para o produto "${cleanPlatform}" com esta duração.`);
    }

    const now = nowLocal();

    if (userRow.role === 'reseller') {
      const newCredits = parseFloat((parseFloat(userRow.credits) - totalCost).toFixed(2));
      await tx.run('UPDATE users SET credits = ?, updated_at = ? WHERE id = ?', [newCredits, now, userId]);
    }

    const generatedKeys = [];

    for (const keyRow of keyRows) {
      await tx.run('DELETE FROM key_reservoir WHERE id = ?', [keyRow.id]);

      const expiresAt = addDays(now, dur);
      const existingKey = await tx.queryOne('SELECT id FROM keys WHERE key_code = ?', [keyRow.key_code]);
      let keyId = existingKey ? existingKey.id : null;

      if (!existingKey) {
        const insertRes = await tx.run(`
          INSERT INTO keys (key_code, user_id, status, duration_days, activated_at, expires_at, created_at, updated_at)
          VALUES (?, ?, 'active', ?, ?, ?, ?, ?)
        `, [keyRow.key_code, userId, dur, now, expiresAt, now, now]);
        keyId = insertRes.lastInsertRowid;
      } else {
        await tx.run(`
          UPDATE keys 
          SET user_id = ?, status = 'active', duration_days = ?, activated_at = ?, expires_at = ?, updated_at = ? 
          WHERE id = ?
        `, [userId, dur, now, expiresAt, now, existingKey.id]);
      }

      await logService.createLog({
        userId: actor?.id,
        username: actor?.username,
        action: 'key_claimed_from_stock',
        keyCode: keyRow.key_code,
        details: {
          platform: cleanPlatform,
          duration_days: dur,
          credit_cost: creditCost,
          target_user: userRow.username
        },
        ipAddress
      });

      const finalKey = await tx.queryOne('SELECT * FROM keys WHERE id = ?', [keyId]);
      generatedKeys.push(finalKey);
    }

    return generatedKeys;
  });
}

async function listStock(platform, duration_days) {
  const dur = parseFloat(duration_days);
  return await db.query(
    "SELECT id, key_code, created_at FROM key_reservoir WHERE platform = ? AND ABS(duration_days - ?) < 0.001 AND status = 'available' ORDER BY created_at DESC",
    [platform, dur]
  );
}

async function deleteStockKey(id, actor) {
  const key = await db.queryOne("SELECT * FROM key_reservoir WHERE id = ?", [id]);
  if (!key) throw new Error('Key não encontrada no estoque.');

  await db.run("DELETE FROM key_reservoir WHERE id = ?", [id]);

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: 'reservoir_key_deleted',
    details: {
      key_code: key.key_code,
      platform: key.platform,
      duration_days: key.duration_days
    }
  });

  return true;
}

async function deleteBulkStockKeys(platform, duration_days, actor) {
  const dur = parseFloat(duration_days);
  const result = await db.run(
    "DELETE FROM key_reservoir WHERE platform = ? AND ABS(duration_days - ?) < 0.001 AND status = 'available'",
    [platform, dur]
  );

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: 'reservoir_bulk_keys_deleted',
    details: {
      platform,
      duration_days: dur
    }
  });

  return { deleted: result?.changes || 0 };
}

module.exports = {
  addBulkKeys,
  getReservoirStats,
  claimKey,
  listAvailableProducts,
  claimKeyForUser,
  listStock,
  deleteStockKey,
  deleteBulkStockKeys
};
