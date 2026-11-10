const express = require('express');
const router = express.Router();
const multer = require('multer');
const publicFilesService = require('../services/publicFilesService');
const { authRequired, requireRoles } = require('../middleware/auth');
const config = require('../config');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});


router.get('/info/:slug', async (req, res) => {
  try {
    const file = await publicFilesService.getFileInfo(req.params.slug);
    if (!file) return res.status(404).json({ error: 'Arquivo não encontrado.' });
    return res.json({ file });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/download/:slug', async (req, res) => {
  try {
    const file = await publicFilesService.getFileData(req.params.slug);
    if (!file) return res.status(404).json({ error: 'Arquivo não encontrado.' });

    const buffer = Buffer.from(file.filedata, 'base64');
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});


router.use(authRequired);
router.use(requireRoles(config.roles.OWNER, config.roles.ADMIN, config.roles.DOWNLOAD_ADMIN));

router.get('/', async (req, res) => {
  try {
    const files = await publicFilesService.listFiles();
    return res.json({ files });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const { title, description, slug, tutorial_url } = req.body;
    const filedata = req.file.buffer.toString('base64');

    const file = await publicFilesService.createFile({
      slug: slug || title,
      title,
      description,
      tutorial_url: tutorial_url || '',
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      filesize: req.file.size,
      filedata
    });

    return res.status(201).json({ message: 'Arquivo enviado com sucesso!', file });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const file = await publicFilesService.updateFile(parseInt(req.params.id, 10), req.body);
    return res.json({ message: 'Arquivo atualizado com sucesso!', file });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await publicFilesService.deleteFile(parseInt(req.params.id, 10));
    return res.json({ message: 'Arquivo removido com sucesso.' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
