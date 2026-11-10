const express = require('express');
const logService = require('../services/logService');
const userService = require('../services/userService');
const { authRequired, requireRoles } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

router.use(authRequired);
router.use(requireRoles(config.roles.OWNER, config.roles.ADMIN));

router.get('/', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const offset = parseInt(req.query.offset || '0', 10);
    const filterUserId = req.query.user_id ? parseInt(req.query.user_id, 10) : null;

    let managedUserIds = [];
    if (req.user.role === config.roles.ADMIN) {
      managedUserIds = await userService.getManagedUserIds(req.user.id);
    }

    const logs = await logService.getLogs({
      userId: req.user.id,
      role: req.user.role,
      managedUserIds,
      limit,
      offset,
      search,
      filterUserId
    });

    const total = await logService.getLogsCount({
      userId: req.user.id,
      role: req.user.role,
      managedUserIds,
      search,
      filterUserId
    });

    return res.json({ logs, total, limit, offset });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
