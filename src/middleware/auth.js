const jwt = require('jsonwebtoken');
const config = require('../config');
const userService = require('../services/userService');

async function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwt.secret);
    const user = await userService.findById(payload.id);

    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Sessão inválida' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      reseller_type: user.reseller_type,
      credits: user.credits,
      status: user.status,
      parent_id: user.parent_id
    };

    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    next();
  };
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

module.exports = { authRequired, requireRoles, signToken };
