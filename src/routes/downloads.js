const express = require('express');
const router = express.Router();
const { authRequired, requireRoles } = require('../middleware/auth');
const config = require('../config');
const downloadService = require('../services/downloadService');

router.get('/public/:slug', async (req, res) => {
  try {
    const download = await downloadService.getDownloadByPublicUrl(req.params.slug);
    if (!download) {
      return res.status(404).json({ error: 'Download não encontrado.' });
    }
    return res.json({ download });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/', authRequired, async (req, res) => {
  try {
    const downloads = await downloadService.listDownloads();
    res.json({ downloads });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authRequired, requireRoles(config.roles.OWNER, config.roles.ADMIN, config.roles.DOWNLOAD_ADMIN), async (req, res) => {
  try {
    const download = await downloadService.createDownload(req.body);
    res.status(201).json(download);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authRequired, requireRoles(config.roles.OWNER, config.roles.ADMIN, config.roles.DOWNLOAD_ADMIN), async (req, res) => {
  try {
    const download = await downloadService.updateDownload(req.params.id, req.body);
    res.json(download);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', authRequired, requireRoles(config.roles.OWNER, config.roles.ADMIN, config.roles.DOWNLOAD_ADMIN), async (req, res) => {
  try {
    const result = await downloadService.deleteDownload(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
