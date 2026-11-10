const express = require('express');
const permissionService = require('../services/permissionService');
const { authRequired, requireRoles } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

router.use(authRequired);
router.use(requireRoles(config.roles.OWNER));

router.get('/', async (req, res) => {
  try {
    const permissions = await permissionService.listPermissions();
    return res.json({ permissions });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { discordId, name } = req.body || {};
    await permissionService.addPermission({
      discordId: String(discordId || '').trim(),
      name: String(name || '').trim(),
      actor: req.user
    });
    return res.status(201).json({ success: true, message: 'Permissão concedida' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await permissionService.deletePermission(id, req.user);
    return res.json({ success: true, message: 'Permissão revogada' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
