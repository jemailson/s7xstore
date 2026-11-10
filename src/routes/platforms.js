const express = require('express');
const router = express.Router();
const platformService = require('../services/platformService');
const { authRequired, requireRoles } = require('../middleware/auth');
const config = require('../config');

router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    const platforms = await platformService.listPlatforms();
    return res.json({ platforms });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/', requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    const { name, slug, emoji, durations } = req.body || {};
    const platform = await platformService.createPlatform({
      name,
      slug,
      emoji,
      durations,
      actor: req.user
    });
    return res.status(201).json({ message: 'Dispositivo/Plataforma adicionado com sucesso', platform });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.put('/:id', requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    const { name, durations, emoji } = req.body || {};
    const platform = await platformService.updatePlatform({
      id: req.params.id,
      name,
      durations,
      emoji,
      actor: req.user
    });
    return res.json({ message: 'Dispositivo/Plataforma atualizado com sucesso', platform });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    const { name, durations, emoji } = req.body || {};
    const platform = await platformService.updatePlatform({
      id: req.params.id,
      name,
      durations,
      emoji,
      actor: req.user
    });
    return res.json({ message: 'Dispositivo/Plataforma atualizado com sucesso', platform });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    const identifier = req.params.id;
    const bodySlug = req.body?.slug;
    await platformService.deletePlatform(identifier, bodySlug, req.user);
    return res.json({ message: 'Plataforma/Gerador removido com sucesso' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
