const db = require('../database/db');
const { nowLocal } = require('../utils/helpers');

async function listFiles() {
  const rows = await db.query(
    'SELECT id, slug, title, description, tutorial_url, filename, mimetype, filesize, created_at FROM public_files ORDER BY id DESC'
  );
  return rows;
}

async function getFileInfo(slug) {
  const file = await db.queryOne(
    'SELECT id, slug, title, description, tutorial_url, filename, mimetype, filesize, created_at FROM public_files WHERE slug = ?',
    [slug]
  );
  if (!file) return null;

  let tutorialUrl = file.tutorial_url || '';

  if (!tutorialUrl) {
    try {
      const bySlug = await db.queryOne(
        `SELECT tutorial_url, tutorial_link FROM downloads 
         WHERE slug = ? 
            OR public_url = ? 
            OR public_url LIKE ? 
            OR public_url LIKE ?
         LIMIT 1`,
        [slug, slug, `%/f/${slug}%`, `%${slug}%`]
      );

      if (bySlug && (bySlug.tutorial_url || bySlug.tutorial_link)) {
        tutorialUrl = bySlug.tutorial_url || bySlug.tutorial_link;
      }
    } catch (e) {}
  }

  if (!tutorialUrl && file.title) {
    try {
      const cleanTitle = file.title.trim().toLowerCase();
      const allDownloads = await db.query(
        "SELECT title, tutorial_url, tutorial_link FROM downloads WHERE (tutorial_url IS NOT NULL AND tutorial_url != '') OR (tutorial_link IS NOT NULL AND tutorial_link != '')"
      );
      for (const d of allDownloads) {
        const dTitle = String(d.title || '').trim().toLowerCase();
        const dTut = d.tutorial_url || d.tutorial_link;
        if (!dTut) continue;
        if (cleanTitle.includes(dTitle) || dTitle.includes(cleanTitle)) {
          tutorialUrl = dTut;
          break;
        }
        const words = cleanTitle.split(/\s+/).filter(w => w.length > 3);
        if (words.length > 0 && words.some(w => dTitle.includes(w))) {
          tutorialUrl = dTut;
          break;
        }
      }
    } catch (e) {}
  }

  if (!tutorialUrl) {
    try {
      const singleDownload = await db.queryOne(
        "SELECT tutorial_url, tutorial_link FROM downloads WHERE (tutorial_url IS NOT NULL AND tutorial_url != '') OR (tutorial_link IS NOT NULL AND tutorial_link != '') LIMIT 1"
      );
      if (singleDownload) {
        tutorialUrl = singleDownload.tutorial_url || singleDownload.tutorial_link;
      }
    } catch (e) {}
  }

  return {
    ...file,
    tutorial_url: tutorialUrl || '',
    tutorial_link: tutorialUrl || ''
  };
}

async function getFileData(slug) {
  return db.queryOne(
    'SELECT filename, mimetype, filedata FROM public_files WHERE slug = ?',
    [slug]
  );
}

async function createFile({ slug, title, description, tutorial_url = '', filename, mimetype, filesize, filedata }) {
  if (!title || !title.trim()) throw new Error('Título é obrigatório.');
  if (!filename) throw new Error('Arquivo é obrigatório.');
  if (!slug || !slug.trim()) throw new Error('Slug é obrigatório.');

  const cleanSlug = slug.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const existing = await db.queryOne('SELECT id FROM public_files WHERE slug = ?', [cleanSlug]);
  if (existing) throw new Error(`Já existe um arquivo com o slug '${cleanSlug}'.`);

  await db.run(`
    INSERT INTO public_files (slug, title, description, tutorial_url, filename, mimetype, filesize, filedata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    cleanSlug,
    title.trim(),
    description ? description.trim() : null,
    tutorial_url ? tutorial_url.trim() : null,
    filename,
    mimetype,
    filesize,
    filedata,
    nowLocal()
  ]);

  return getFileInfo(cleanSlug);
}

async function updateFile(id, { title, description, slug, tutorial_url }) {
  const existing = await db.queryOne('SELECT * FROM public_files WHERE id = ?', [id]);
  if (!existing) throw new Error('Arquivo não encontrado.');

  const cleanTitle = title !== undefined ? title.trim() : existing.title;
  const cleanDesc = description !== undefined ? description.trim() : existing.description;
  const cleanTut = tutorial_url !== undefined ? tutorial_url.trim() : (existing.tutorial_url || '');
  const cleanSlug = slug !== undefined
    ? slug.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    : existing.slug;

  await db.run(`
    UPDATE public_files
    SET title = ?, description = ?, tutorial_url = ?, slug = ?
    WHERE id = ?
  `, [cleanTitle, cleanDesc, cleanTut, cleanSlug, id]);

  return getFileInfo(cleanSlug);
}

async function deleteFile(id) {
  const existing = await db.queryOne('SELECT id, title FROM public_files WHERE id = ?', [id]);
  if (!existing) throw new Error('Arquivo não encontrado.');
  await db.run('DELETE FROM public_files WHERE id = ?', [id]);
  return true;
}

module.exports = {
  listFiles,
  getFileInfo,
  getFileData,
  createFile,
  updateFile,
  deleteFile
};
