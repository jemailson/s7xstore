const express = require('express');
const keyService = require('../services/keyService');
const reservoirService = require('../services/reservoirService');
const { authRequired, requireRoles } = require('../middleware/auth');
const { getClientIp } = require('../utils/helpers');
const config = require('../config');

const router = express.Router();

router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);

    const keys = await keyService.listKeys({
      actor: req.user,
      search,
      status,
      limit,
      offset
    });

    const total = await keyService.countKeys({
      actor: req.user,
      search,
      status
    });

    return res.json({ keys, total, limit, offset });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const quantity = parseInt(req.body?.quantity || '1', 10);
    const durationDays = parseFloat(req.body?.duration_days || '30');
    const prefix = req.body?.prefix || 'S7X-XXX';
    let userId = req.user.id;

    if (req.user.role === config.roles.OWNER || req.user.role === config.roles.ADMIN) {
      if (req.body?.user_id) {
        userId = parseInt(req.body.user_id, 10);
      }
    }

    const keys = await keyService.createKeys({
      userId,
      quantity,
      durationDays,
      prefix,
      actor: req.user,
      ipAddress: getClientIp(req)
    });

    return res.status(201).json({ keys });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/:id/pause', async (req, res) => {
  try {
    const key = await keyService.pauseKey(
      parseInt(req.params.id, 10),
      req.user,
      getClientIp(req)
    );
    return res.json({ key, message: 'Key pausada' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/:id/resume', async (req, res) => {
  try {
    const key = await keyService.resumeKey(
      parseInt(req.params.id, 10),
      req.user,
      getClientIp(req)
    );
    return res.json({ key, message: 'Key retomada' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/:id/restore', async (req, res) => {
  try {
    const key = await keyService.restoreKey(
      parseInt(req.params.id, 10),
      req.user,
      getClientIp(req)
    );
    return res.json({ key, message: 'Key restaurada — dispositivo desvinculado' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/:id/unbind', requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    const key = await keyService.unbindDevice(
      parseInt(req.params.id, 10),
      req.user,
      getClientIp(req)
    );
    return res.json({ key, message: 'Vínculo de dispositivo removido' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const key = await keyService.deleteKey(
      parseInt(req.params.id, 10),
      req.user,
      getClientIp(req)
    );
    return res.json({ key, message: 'Key desativada' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/permanent', requireRoles(config.roles.OWNER), async (req, res) => {
  try {
    await keyService.hardDeleteKey(
      parseInt(req.params.id, 10),
      req.user,
      getClientIp(req)
    );
    return res.json({ message: 'Key excluída permanentemente' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/bulk', requireRoles(config.roles.OWNER), async (req, res) => {
  try {
    const { platform, duration_days, keys } = req.body || {};
    
    let keyCodes = [];
    if (typeof keys === 'string') {
      keyCodes = keys.split(/[\r\n,;]+/).map(k => k.replace(/["']/g, '').trim()).filter(k => k.length > 0);
    } else if (Array.isArray(keys)) {
      keyCodes = keys.map(k => String(k || '').replace(/["']/g, '').trim()).filter(k => k.length > 0);
    } else {
      return res.status(400).json({ error: 'Nenhuma key informada no campo keys.' });
    }

    const result = await reservoirService.addBulkKeys({
      platform,
      durationDays: parseFloat(duration_days),
      keyCodes,
      actor: req.user
    });

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/reservoir-stats', requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    const data = await reservoirService.getReservoirStats();
    return res.json(data);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/products', async (req, res) => {
  try {
    const products = await reservoirService.listAvailableProducts();
    return res.json({ products });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/claim-from-stock', async (req, res) => {
  try {
    const { platform, duration_days, quantity } = req.body || {};
    if (!platform) return res.status(400).json({ error: 'Produto não informado.' });

    const keys = await reservoirService.claimKeyForUser({
      platform,
      durationDays: parseFloat(duration_days || 30),
      quantity,
      userId: req.user.id,
      actor: req.user,
      ipAddress: getClientIp(req)
    });

    return res.status(201).json({ keys });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/reservoir/stock', requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    const { platform, duration_days } = req.query;
    if (!platform || !duration_days) return res.status(400).json({ error: 'Faltam parâmetros.' });
    
    const keys = await reservoirService.listStock(platform, parseFloat(duration_days));
    return res.json({ keys });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/reservoir/stock/:id', requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    await reservoirService.deleteStockKey(parseInt(req.params.id, 10), req.user);
    return res.json({ message: 'Key removida do estoque.' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/reservoir/stock-bulk/all', requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    const { platform, duration_days } = req.query;
    if (!platform || !duration_days) return res.status(400).json({ error: 'Faltam parâmetros.' });
    
    await reservoirService.deleteBulkStockKeys(platform, parseFloat(duration_days), req.user);
    return res.json({ message: 'Keys removidas do estoque com sucesso.' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
