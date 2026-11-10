const db = require('../database/db');
const { nowLocal } = require('../utils/helpers');

function mapDownload(row) {
  if (!row) return null;
  const platform = row.platform_type || row.icon || 'android';
  const downloadLink = row.download_url || row.direct_link || '';
  const slug = row.public_url || row.slug || '';
  const tutorial = row.tutorial_url || row.tutorial_link || '';
  const mt = row.mt_manager_url || row.mt_manager_link || '';
  const channel = row.channel_url || row.channel_link || '';

  return {
    ...row,
    platform_type: platform,
    icon: platform,
    download_url: downloadLink,
    direct_link: downloadLink,
    public_url: slug,
    slug: slug,
    tutorial_url: tutorial,
    tutorial_link: tutorial,
    mt_manager_url: mt,
    mt_manager_link: mt,
    channel_url: channel,
    channel_link: channel
  };
}

async function listDownloads() {
  const rows = await db.query('SELECT * FROM downloads ORDER BY id ASC');
  return rows.map(mapDownload);
}

async function getDownloadById(id) {
  const row = await db.queryOne('SELECT * FROM downloads WHERE id = ?', [id]);
  return mapDownload(row);
}

async function getDownloadByPublicUrl(public_url) {
  const clean = String(public_url || '').trim();
  const row = await db.queryOne('SELECT * FROM downloads WHERE public_url = ? OR slug = ?', [clean, clean]);
  return mapDownload(row);
}

async function createDownload({ title, platform_type = 'android', version = '', download_url, public_url = '', tutorial_url = '', mt_manager_url = '', channel_url = '' }) {
  if (!title || !title.trim()) {
    throw new Error('Título é obrigatório.');
  }
  if (!download_url || !download_url.trim()) {
    throw new Error('Link de download é obrigatório.');
  }

  const cleanTitle = title.trim();
  const cleanPlatform = (platform_type || 'android').trim();
  const cleanVersion = (version || '').trim();
  const cleanDownloadUrl = download_url.trim();
  const cleanSlug = (public_url || title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const cleanTutorialUrl = (tutorial_url || '').trim();
  const cleanMtManagerUrl = (mt_manager_url || '').trim();
  const cleanChannelUrl = (channel_url || '').trim();
  const now = nowLocal();

  const res = await db.run(`
    INSERT INTO downloads (
      title, platform_type, icon, version, download_url, direct_link,
      public_url, slug, tutorial_url, tutorial_link,
      mt_manager_url, mt_manager_link, channel_url, channel_link,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    cleanTitle, cleanPlatform, cleanPlatform, cleanVersion, cleanDownloadUrl, cleanDownloadUrl,
    cleanSlug, cleanSlug, cleanTutorialUrl, cleanTutorialUrl,
    cleanMtManagerUrl, cleanMtManagerUrl, cleanChannelUrl, cleanChannelUrl,
    now, now
  ]);

  return getDownloadById(res.lastInsertRowid);
}

async function updateDownload(id, { title, platform_type, version, download_url, public_url, tutorial_url, mt_manager_url, channel_url }) {
  const existing = await getDownloadById(id);
  if (!existing) {
    throw new Error('Item de download não encontrado.');
  }

  const cleanTitle = title !== undefined ? title.trim() : existing.title;
  const cleanPlatform = platform_type !== undefined ? platform_type.trim() : (existing.platform_type || existing.icon || 'android');
  const cleanVersion = version !== undefined ? version.trim() : (existing.version || '');
  const cleanDownloadUrl = download_url !== undefined ? download_url.trim() : (existing.download_url || existing.direct_link || '');
  const cleanSlug = public_url !== undefined
    ? (public_url.trim() || cleanTitle.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
    : (existing.public_url || existing.slug || '');
  const cleanTutorialUrl = tutorial_url !== undefined ? tutorial_url.trim() : (existing.tutorial_url || existing.tutorial_link || '');
  const cleanMtManagerUrl = mt_manager_url !== undefined ? mt_manager_url.trim() : (existing.mt_manager_url || existing.mt_manager_link || '');
  const cleanChannelUrl = channel_url !== undefined ? channel_url.trim() : (existing.channel_url || existing.channel_link || '');
  const now = nowLocal();

  await db.run(`
    UPDATE downloads 
    SET title = ?, platform_type = ?, icon = ?, version = ?, download_url = ?, direct_link = ?,
        public_url = ?, slug = ?, tutorial_url = ?, tutorial_link = ?,
        mt_manager_url = ?, mt_manager_link = ?, channel_url = ?, channel_link = ?,
        updated_at = ?
    WHERE id = ?
  `, [
    cleanTitle, cleanPlatform, cleanPlatform, cleanVersion, cleanDownloadUrl, cleanDownloadUrl,
    cleanSlug, cleanSlug, cleanTutorialUrl, cleanTutorialUrl,
    cleanMtManagerUrl, cleanMtManagerUrl, cleanChannelUrl, cleanChannelUrl,
    now, id
  ]);

  return getDownloadById(id);
}

async function deleteDownload(id) {
  const existing = await getDownloadById(id);
  if (!existing) {
    throw new Error('Item de download não encontrado.');
  }
  await db.run('DELETE FROM downloads WHERE id = ?', [id]);
  return { success: true };
}

module.exports = {
  listDownloads,
  getDownloadById,
  getDownloadByPublicUrl,
  createDownload,
  updateDownload,
  deleteDownload
};
