const db = require('../database/db');
const { nowLocal } = require('../utils/helpers');
const logService = require('./logService');

function parseDurations(durations) {
  if (!durations) return null;
  try {
    const parsed = typeof durations === 'string' ? JSON.parse(durations) : durations;
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

async function listPlatforms() {
  const rows = await db.query("SELECT * FROM platforms WHERE status = 'active' ORDER BY id ASC");
  return rows.map(r => ({
    ...r,
    durations: parseDurations(r.durations)
  }));
}

async function getAllPlatforms() {
  const rows = await db.query("SELECT * FROM platforms ORDER BY id ASC");
  return rows.map(r => ({
    ...r,
    durations: parseDurations(r.durations)
  }));
}

async function createPlatform({ name, slug, emoji, durations, actor }) {
  if (!name || !name.trim()) throw new Error('Nome da plataforma é obrigatório');
  
  const cleanName = name.trim();
  const cleanSlug = (slug || cleanName)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!cleanSlug) throw new Error('Identificador (slug) inválido');

  const existing = await db.queryOne('SELECT id FROM platforms WHERE slug = ?', [cleanSlug]);
  if (existing) {
    throw new Error(`A plataforma com identificador '${cleanSlug}' já existe.`);
  }

  const cleanEmoji = emoji ? emoji.trim() : 'mobile';

  let durationsJson = null;
  if (durations && Array.isArray(durations) && durations.length > 0) {
    const cleanArray = durations.map(d => ({
      days: parseFloat(d.days),
      label: String(d.label || '').trim() || (parseFloat(d.days) < 1 ? `${Math.round(parseFloat(d.days) * 24)} hora(s)` : `${d.days} dia(s)`),
      credits: d.credits !== undefined ? parseFloat(d.credits) : 1.0
    })).filter(d => !isNaN(d.days) && d.days > 0);
    durationsJson = cleanArray.length > 0 ? JSON.stringify(cleanArray) : null;
  }

  await db.run(`
    INSERT INTO platforms (slug, name, emoji, status, durations, created_at)
    VALUES (?, ?, ?, 'active', ?, ?)
  `, [cleanSlug, cleanName, cleanEmoji, durationsJson, nowLocal()]);

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: 'platform_created',
    details: { name: cleanName, slug: cleanSlug, emoji: cleanEmoji, durations: durationsJson }
  });

  return { slug: cleanSlug, name: cleanName, emoji: cleanEmoji, durations: parseDurations(durationsJson) };
}

async function updatePlatform({ id, name, durations, emoji, actor }) {
  const isNumeric = !isNaN(id) && String(id).trim() !== '';
  let platform = null;

  if (isNumeric) {
    platform = await db.queryOne('SELECT * FROM platforms WHERE id = ?', [parseInt(id, 10)]);
  }

  if (!platform) {
    platform = await db.queryOne('SELECT * FROM platforms WHERE slug = ? OR LOWER(slug) = LOWER(?)', [String(id), String(id)]);
  }

  if (!platform) {
    const cleanSlug = String(id).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const cleanName = (name && name.trim()) || cleanSlug.toUpperCase();
    await createPlatform({ name: cleanName, slug: cleanSlug, emoji: emoji || 'mobile', durations, actor });
    platform = await db.queryOne('SELECT * FROM platforms WHERE slug = ?', [cleanSlug]);
    if (!platform) throw new Error('Plataforma/Produto não encontrado');
    return {
      ...platform,
      durations: parseDurations(platform.durations)
    };
  }

  const platId = platform.id;

  let cleanName = platform.name;
  if (name && name.trim()) {
    cleanName = name.trim();
  }

  let durationsJson = platform.durations;
  if (durations !== undefined) {
    if (durations === null) {
      durationsJson = null;
    } else {
      const durArray = Array.isArray(durations) ? durations : [];
      const cleanArray = durArray.map(d => {
        const days = parseFloat(d.days);
        const credits = d.credits !== undefined ? parseFloat(d.credits) : 1.0;
        let label = String(d.label || '').trim();
        if (!label) {
          label = days < 1 
            ? `${Math.round(days * 24)} ${Math.round(days * 24) === 1 ? 'hora' : 'horas'}` 
            : `${days} ${days === 1 ? 'dia' : 'dias'}`;
        }
        return {
          days,
          label,
          credits
        };
      }).filter(d => !isNaN(d.days) && d.days > 0);

      durationsJson = cleanArray.length > 0 ? JSON.stringify(cleanArray) : null;
    }
  }

  const cleanEmoji = emoji !== undefined ? String(emoji).trim() : platform.emoji;

  await db.run(`
    UPDATE platforms
    SET name = ?, durations = ?, emoji = ?
    WHERE id = ?
  `, [cleanName, durationsJson, cleanEmoji, platId]);

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: 'platform_updated',
    details: { id: platId, name: cleanName, slug: platform.slug, durations: durationsJson }
  });

  const updated = await db.queryOne('SELECT * FROM platforms WHERE id = ?', [platId]);
  return {
    ...updated,
    durations: parseDurations(updated.durations)
  };
}

async function deletePlatform(identifier, secondaryIdentifier, actor) {
  if (secondaryIdentifier && typeof secondaryIdentifier === 'object' && !actor) {
    actor = secondaryIdentifier;
    secondaryIdentifier = null;
  }

  const cleanId = String(identifier || '').trim();
  const cleanSec = String(secondaryIdentifier || '').trim();

  const idCandidates = [cleanId, cleanSec].filter(x => x && x !== 'undefined' && x !== 'null');
  if (idCandidates.length === 0) {
    throw new Error('Identificador da plataforma/gerador não informado');
  }

  const slugsToDelete = new Set();
  const namesToDelete = new Set();
  const dbIdsToDelete = new Set();

  for (const cand of idCandidates) {
    slugsToDelete.add(cand);
    slugsToDelete.add(cand.toLowerCase());

    const isNumeric = !isNaN(cand) && cand !== '';
    if (isNumeric) {
      dbIdsToDelete.add(parseInt(cand, 10));
      const pById = await db.queryOne('SELECT * FROM platforms WHERE id = ?', [parseInt(cand, 10)]);
      if (pById) {
        if (pById.slug) {
          slugsToDelete.add(pById.slug);
          slugsToDelete.add(pById.slug.toLowerCase());
        }
        if (pById.name) {
          namesToDelete.add(pById.name);
          namesToDelete.add(pById.name.toLowerCase());
        }
      }
    }

    const pBySlug = await db.queryOne(
      'SELECT * FROM platforms WHERE slug = ? OR LOWER(slug) = LOWER(?) OR LOWER(name) = LOWER(?)',
      [cand, cand, cand]
    );
    if (pBySlug) {
      dbIdsToDelete.add(pBySlug.id);
      if (pBySlug.slug) {
        slugsToDelete.add(pBySlug.slug);
        slugsToDelete.add(pBySlug.slug.toLowerCase());
      }
      if (pBySlug.name) {
        namesToDelete.add(pBySlug.name);
        namesToDelete.add(pBySlug.name.toLowerCase());
      }
    }
  }

  for (const platId of dbIdsToDelete) {
    await db.run('DELETE FROM platforms WHERE id = ?', [platId]);
  }

  for (const s of slugsToDelete) {
    await db.run('DELETE FROM platforms WHERE LOWER(slug) = LOWER(?) OR slug = ?', [s, s]);
  }
  for (const n of namesToDelete) {
    await db.run('DELETE FROM platforms WHERE LOWER(name) = LOWER(?)', [n]);
  }

  for (const s of slugsToDelete) {
    await db.run(
      'DELETE FROM key_reservoir WHERE LOWER(TRIM(platform)) = LOWER(TRIM(?)) OR TRIM(platform) = TRIM(?) OR platform = ?',
      [s, s, s]
    );
  }

  await logService.createLog({
    userId: actor?.id,
    username: actor?.username,
    action: 'platform_deleted',
    details: { slugs: Array.from(slugsToDelete), ids: Array.from(dbIdsToDelete) }
  });

  return true;
}

module.exports = {
  listPlatforms,
  getAllPlatforms,
  createPlatform,
  updatePlatform,
  deletePlatform
};
