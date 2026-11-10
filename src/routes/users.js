const express = require('express');
const userService = require('../services/userService');
const { authRequired, requireRoles } = require('../middleware/auth');
const config = require('../config');
const db = require('../database/db');

const router = express.Router();

router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    if (req.user.role === config.roles.RESELLER || req.user.role === config.roles.MEMBER || req.user.role === config.roles.DOWNLOAD_ADMIN) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const search = String(req.query.search || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '2000', 10), 5000);
    const offset = parseInt(req.query.offset || '0', 10);

    const profiles = await userService.listProfiles({
      actor: req.user,
      search,
      limit,
      offset
    });

    return res.json({ profiles });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/', requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    const { username, password, role, reseller_type, credits } = req.body || {};

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'username, password e role são obrigatórios' });
    }

    if (req.user.role === config.roles.ADMIN) {
      if (![config.roles.RESELLER, config.roles.MEMBER].includes(role)) {
        return res.status(403).json({ error: 'Administrador só pode criar revendedores ou membros' });
      }
    }

    if (req.user.role === config.roles.OWNER) {
      if (![config.roles.ADMIN, config.roles.RESELLER, config.roles.MEMBER, config.roles.DOWNLOAD_ADMIN].includes(role)) {
        return res.status(400).json({ error: 'Role inválida' });
      }
    }

    const user = await userService.createUser({
      username,
      password,
      role,
      resellerType: reseller_type || config.resellerTypes.CLASSIC,
      credits: parseFloat(credits || '0'),
      parentId: req.user.role === config.roles.ADMIN ? req.user.id : (req.body.parent_id || req.user.id),
      actor: req.user
    });

    return res.status(201).json({ user });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/credits', requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (!(await userService.canManageUser(req.user, targetId))) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const { amount, set } = req.body || {};
    let user;

    if (typeof set === 'number') {
      user = await userService.setCredits(targetId, set, req.user);
    } else if (typeof amount === 'number') {
      user = await userService.updateCredits(targetId, amount, req.user, 'credits_change');
    } else {
      return res.status(400).json({ error: 'Informe amount ou set' });
    }

    return res.json({ user });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/status', requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (!(await userService.canManageUser(req.user, targetId))) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const user = await userService.updateStatus(targetId, req.body?.status, req.user);
    return res.json({ user });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (!(await userService.canManageUser(req.user, targetId))) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const user = await userService.updateProfile(targetId, {
      password: req.body?.password,
      resellerType: req.body?.reseller_type,
      customPrefix: req.body?.custom_prefix,
      displayName: req.body?.display_name,
      avatarUrl: req.body?.avatar_url
    }, req.user);

    return res.json({ user });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/reset-device', requireRoles(config.roles.OWNER), async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const user = await userService.resetUserDevice(targetId, req.user);
    return res.json({ user });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireRoles(config.roles.OWNER), async (req, res) => {
  try {
    await userService.deleteUser(parseInt(req.params.id, 10), req.user);
    return res.json({ message: 'Perfil excluído' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ── Permissões de Produto por Usuário ──────────────────────────────────────

router.get('/:id/product-permissions', requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const platforms = await db.query("SELECT slug, name FROM platforms WHERE status = 'active' ORDER BY name ASC");
    const perms = await db.query(
      'SELECT platform_slug, allowed FROM user_product_permissions WHERE user_id = ?',
      [targetId]
    );
    const permMap = {};
    for (const p of perms) {
      permMap[p.platform_slug] = p.allowed === true || p.allowed === 1;
    }
    const result = platforms.map(p => ({
      platform_slug: p.slug,
      platform_name: p.name,
      allowed: permMap[p.slug] !== undefined ? permMap[p.slug] : true
    }));
    return res.json({ permissions: result });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.put('/:id/product-permissions', requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { permissions } = req.body || {};
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions deve ser um array' });
    }
    for (const perm of permissions) {
      const { platform_slug, allowed } = perm;
      if (!platform_slug) continue;
      const allowedVal = db.isPg ? Boolean(allowed) : (allowed ? 1 : 0);
      const existing = await db.queryOne(
        'SELECT id FROM user_product_permissions WHERE user_id = ? AND platform_slug = ?',
        [targetId, platform_slug]
      );
      if (existing) {
        await db.run(
          'UPDATE user_product_permissions SET allowed = ? WHERE user_id = ? AND platform_slug = ?',
          [allowedVal, targetId, platform_slug]
        );
      } else {
        await db.run(
          'INSERT INTO user_product_permissions (user_id, platform_slug, allowed) VALUES (?, ?, ?)',
          [targetId, platform_slug, allowedVal]
        );
      }
    }
    return res.json({ message: 'Permissões atualizadas com sucesso' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
