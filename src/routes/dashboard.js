const express = require('express');
const db = require('../database/db');
const { authRequired } = require('../middleware/auth');
const userService = require('../services/userService');
const config = require('../config');

const router = express.Router();

router.use(authRequired);

router.get('/stats', async (req, res) => {
  try {
    const actor = req.user;
    let keyFilter = '';
    let userFilter = '';
    const keyParams = [];
    const userParams = [];

    if (actor.role === config.roles.RESELLER || actor.role === config.roles.MEMBER || actor.role === config.roles.DOWNLOAD_ADMIN) {
      keyFilter = ' WHERE user_id = ?';
      keyParams.push(actor.id);
      userFilter = ' WHERE id = ?';
      userParams.push(actor.id);
    } else if (actor.role === config.roles.ADMIN) {
      const managed = await userService.getManagedUserIds(actor.id);
      const ids = [actor.id, ...managed];
      keyFilter = ` WHERE user_id IN (${ids.map(() => '?').join(',')})`;
      keyParams.push(...ids);
      userFilter = ` WHERE id IN (${ids.map(() => '?').join(',')})`;
      userParams.push(...ids);
    }

    const keyStats = await db.query(`
      SELECT status, COUNT(*) as count FROM keys${keyFilter} GROUP BY status
    `, keyParams);

    const keys = {
      total: 0,
      awaiting_activation: 0,
      active: 0,
      paused: 0,
      expired: 0,
      deactivated: 0
    };

    for (const row of keyStats) {
      const cnt = parseInt(row.count || row.COUNT || 0, 10);
      keys[row.status] = cnt;
      keys.total += cnt;
    }

    const profilesRow = await db.queryOne(`SELECT COUNT(*) as c FROM users${userFilter}`, userParams);
    const profiles = {
      total: profilesRow ? parseInt(profilesRow.c || profilesRow.count || 0, 10) : 0,
      admins: 0,
      resellers: 0
    };

    if (actor.role === config.roles.OWNER) {
      const adminsRow = await db.queryOne(`SELECT COUNT(*) as c FROM users WHERE role = 'admin'`);
      profiles.admins = adminsRow ? parseInt(adminsRow.c || adminsRow.count || 0, 10) : 0;
      
      const resellersRow = await db.queryOne(`SELECT COUNT(*) as c FROM users WHERE role = 'reseller'`);
      profiles.resellers = resellersRow ? parseInt(resellersRow.c || resellersRow.count || 0, 10) : 0;
    } else if (actor.role === config.roles.ADMIN) {
      const resellersRow = await db.queryOne(`SELECT COUNT(*) as c FROM users WHERE parent_id = ?`, [actor.id]);
      profiles.resellers = resellersRow ? parseInt(resellersRow.c || resellersRow.count || 0, 10) : 0;
    }

    const me = await userService.findById(actor.id);

    return res.json({
      keys,
      profiles,
      credits: me?.credits || 0,
      role: actor.role,
      reseller_type: actor.reseller_type
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
