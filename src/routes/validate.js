const express = require('express');
const rateLimit = require('express-rate-limit');
const validationService = require('../services/validationService');
const { getClientIp } = require('../utils/helpers');

const router = express.Router();

const validateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas tentativas. Aguarde.' }
});

router.post('/', validateLimiter, async (req, res) => {
  try {
    const { key, key_code, device_id, device_info, user, uid } = req.body || {};
    const keyCode = key || key_code || user;
    const deviceId = device_id || uid;
    const deviceInfo = device_info || null;
    const ipAddress = getClientIp(req);

    const result = await validationService.validateKey({
      keyCode,
      deviceId,
      deviceInfo,
      ipAddress
    });

    const isApkRequest = user !== undefined || uid !== undefined;

    if (isApkRequest) {
      if (result.success) {
        return res.status(200).type('text/plain').send(deviceId);
      } else {
        return res.status(403).type('text/plain').send(result.message || 'Usuario invalido.');
      }
    }

    const status = result.success ? 200 : 403;
    return res.status(status).json(result);
  } catch (err) {
    const isApkRequest = req.body?.user !== undefined || req.body?.uid !== undefined;
    if (isApkRequest) {
      return res.status(500).type('text/plain').send('Usuario invalido.');
    }
    return res.status(500).json({
      success: false,
      message: 'Usuário inválido'
    });
  }
});

router.get('/', validateLimiter, async (req, res) => {
  try {
    const keyCode = (req.query.key || req.query.key_code || req.query.user || req.query.pass || '').trim();
    const deviceId = (req.query.device_id || req.query.uid || '').trim();
    const deviceInfo = req.query.device_info || null;
    const ipAddress = getClientIp(req);

    if (req.query.user || req.query.uid) {
      console.log(`[APK Route Attempt] Key: ${keyCode}, Device: ${deviceId}, IP: ${ipAddress}`);
    }

    const result = await validationService.validateKey({
      keyCode,
      deviceId,
      deviceInfo,
      ipAddress
    });

    const isApkRequest = req.query.user !== undefined || req.query.uid !== undefined;

    if (isApkRequest) {
      if (result.success) {
        
        return res.status(200).type('text/plain').send(deviceId);
      } else {
        
        return res.status(403).type('text/plain').send(result.message || 'Usuario invalido.');
      }
    }

    const status = result.success ? 200 : 403;
    return res.status(status).json(result);
  } catch (err) {
    const isApkRequest = req.query.user !== undefined || req.query.uid !== undefined;
    if (isApkRequest) {
      return res.status(500).type('text/plain').send('Usuario invalido.');
    }
    return res.status(500).json({
      success: false,
      message: 'Usuário inválido'
    });
  }
});

module.exports = router;
