const db = require('../database/db');
const config = require('../config');
const { nowLocal, addDays, isExpired } = require('../utils/helpers');
const keyService = require('./keyService');
const logService = require('./logService');
const reservoirService = require('./reservoirService');

async function recordActivation({ keyId, deviceId, deviceInfo, ipAddress, success, message }) {
  await db.run(`
    INSERT INTO activations (key_id, device_id, device_info, ip_address, success, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [keyId || null, deviceId, deviceInfo, ipAddress, success ? 1 : 0, message, nowLocal()]);
}

async function validateKey({ keyCode, deviceId, deviceInfo = null, ipAddress = null }) {
  if (!keyCode || !deviceId) {
    return {
      success: false,
      message: config.validationMessages.INVALID,
      status: null
    };
  }

  const cleanKey = keyCode.trim();
  const cleanDevice = deviceId.trim();

  let key = await keyService.findByCode(cleanKey);

  if (!key) {
    try {
      const reservoirKey = await db.queryOne(
        "SELECT * FROM key_reservoir WHERE key_code = ? AND status = 'available'",
        [cleanKey]
      );

      if (reservoirKey) {
        const owner = await db.queryOne("SELECT id FROM users WHERE role = 'owner' ORDER BY id ASC LIMIT 1");
        const ownerId = owner ? owner.id : 1;
        const now = nowLocal();

        await db.run(`
          INSERT INTO keys (key_code, user_id, status, duration_days, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [reservoirKey.key_code, ownerId, config.keyStatus.AWAITING, reservoirKey.duration_days, now, now]);

        await db.run(
          "UPDATE key_reservoir SET status = 'used', used_by = 'APK_AUTO', used_at = ? WHERE id = ?",
          [now, reservoirKey.id]
        );

        console.log(`[Reservoir Auto-Claim] Key ${cleanKey} movida para keys para o device ${cleanDevice}`);
        key = await keyService.findByCode(cleanKey);
      }
    } catch (err) {
      console.error('[Reservoir Auto-Claim Error]', err);
    }
  }

  if (!key) {
    await logService.createLog({
      action: 'access_attempt',
      keyCode: cleanKey,
      details: { result: 'invalid', device_id: cleanDevice },
      ipAddress
    });

    return {
      success: false,
      message: config.validationMessages.INVALID,
      status: null
    };
  }

  key = await keyService.expireIfNeeded(key);

  const baseLog = {
    keyId: key.id,
    keyCode: key.key_code,
    ipAddress
  };

  if (key.status === config.keyStatus.DEACTIVATED) {
    await recordActivation({
      keyId: key.id,
      deviceId: cleanDevice,
      deviceInfo,
      ipAddress,
      success: false,
      message: config.validationMessages.BLOCKED
    });

    await logService.createLog({
      ...baseLog,
      action: 'access_attempt',
      details: { result: 'deactivated', device_id: cleanDevice }
    });

    return {
      success: false,
      message: config.validationMessages.BLOCKED,
      status: key.status
    };
  }

  if (key.status === config.keyStatus.PAUSED) {
    await recordActivation({
      keyId: key.id,
      deviceId: cleanDevice,
      deviceInfo,
      ipAddress,
      success: false,
      message: config.validationMessages.BLOCKED
    });

    await logService.createLog({
      ...baseLog,
      action: 'access_attempt',
      details: { result: 'paused', device_id: cleanDevice }
    });

    return {
      success: false,
      message: config.validationMessages.BLOCKED,
      status: key.status
    };
  }

  if (key.status === config.keyStatus.EXPIRED || (key.expires_at && isExpired(key.expires_at))) {
    if (key.status !== config.keyStatus.EXPIRED) {
      await db.run(`
        UPDATE keys SET status = ?, updated_at = ? WHERE id = ?
      `, [config.keyStatus.EXPIRED, nowLocal(), key.id]);
    }

    await recordActivation({
      keyId: key.id,
      deviceId: cleanDevice,
      deviceInfo,
      ipAddress,
      success: false,
      message: config.validationMessages.EXPIRED
    });

    await logService.createLog({
      ...baseLog,
      action: 'access_attempt',
      details: { result: 'expired', device_id: cleanDevice }
    });

    return {
      success: false,
      message: config.validationMessages.EXPIRED,
      status: config.keyStatus.EXPIRED
    };
  }

  if (key.device_id && key.device_id !== cleanDevice) {
    await recordActivation({
      keyId: key.id,
      deviceId: cleanDevice,
      deviceInfo,
      ipAddress,
      success: false,
      message: config.validationMessages.OTHER_DEVICE
    });

    await logService.createLog({
      ...baseLog,
      action: 'access_attempt',
      details: {
        result: 'other_device',
        device_id: cleanDevice,
        linked_device: key.device_id
      }
    });

    return {
      success: false,
      message: config.validationMessages.OTHER_DEVICE,
      status: key.status
    };
  }

  if (key.device_id === cleanDevice && key.status === config.keyStatus.AWAITING) {
    const activatedAt = nowLocal();
    const expiresAt = addDays(activatedAt, key.duration_days);

    await db.run(`
      UPDATE keys
      SET activated_at = COALESCE(activated_at, ?),
          expires_at = COALESCE(expires_at, ?),
          status = ?,
          updated_at = ?
      WHERE id = ?
    `, [
      activatedAt,
      expiresAt,
      config.keyStatus.ACTIVE,
      nowLocal(),
      key.id
    ]);

    key = await keyService.findById(key.id);
  }

  if (!key.device_id) {
    const activatedAt = key.activated_at || nowLocal();
    const expiresAt = key.expires_at || addDays(activatedAt, key.duration_days);

    await db.run(`
      UPDATE keys
      SET device_id = ?,
          device_info = ?,
          activation_ip = ?,
          activated_at = ?,
          expires_at = ?,
          status = ?,
          updated_at = ?
      WHERE id = ?
    `, [
      cleanDevice,
      deviceInfo,
      ipAddress,
      activatedAt,
      expiresAt,
      config.keyStatus.ACTIVE,
      nowLocal(),
      key.id
    ]);

    await recordActivation({
      keyId: key.id,
      deviceId: cleanDevice,
      deviceInfo,
      ipAddress,
      success: true,
      message: config.validationMessages.SUCCESS
    });

    await logService.createLog({
      ...baseLog,
      action: 'key_activated',
      details: {
        device_id: cleanDevice,
        device_info: deviceInfo,
        activation_ip: ipAddress,
        activated_at: activatedAt,
        expires_at: expiresAt,
        status: config.keyStatus.ACTIVE
      }
    });

    const updated = await keyService.findById(key.id);

    return {
      success: true,
      message: config.validationMessages.SUCCESS,
      status: updated.status,
      expires_at: updated.expires_at,
      activated_at: updated.activated_at,
      duration_days: updated.duration_days
    };
  }

  await recordActivation({
    keyId: key.id,
    deviceId: cleanDevice,
    deviceInfo,
    ipAddress,
    success: true,
    message: config.validationMessages.SUCCESS
  });

  await logService.createLog({
    ...baseLog,
    action: 'access_attempt',
    details: {
      result: 'success',
      device_id: cleanDevice,
      activation_ip: key.activation_ip
    }
  });

  return {
    success: true,
    message: config.validationMessages.SUCCESS,
    status: key.status,
    expires_at: key.expires_at,
    activated_at: key.activated_at,
    duration_days: key.duration_days,
    activation_ip: key.activation_ip
  };
}

module.exports = { validateKey, recordActivation };
