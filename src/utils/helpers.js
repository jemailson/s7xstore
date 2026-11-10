const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

function generateKeyCode(prefix = 'S7X-XXX') {
  const part = () => crypto.randomBytes(5).toString('hex').toUpperCase();
  return `${prefix}-${part()}`;
}

function generateDeviceToken() {
  return uuidv4();
}

function nowLocal(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const get = (type) => parts.find(p => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function addDays(dateStr, days) {
  const d = dateStr ? new Date(dateStr.replace(' ', 'T')) : new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  return nowLocal(d);
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt.replace(' ', 'T')) < new Date();
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '0.0.0.0';
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

function statusLabel(status) {
  const map = {
    awaiting_activation: 'Aguardando ativação',
    active: 'Ativa',
    paused: 'Pausada',
    expired: 'Expirada',
    deactivated: 'Desativada'
  };
  return map[status] || status;
}

module.exports = {
  generateKeyCode,
  generateDeviceToken,
  nowLocal,
  addDays,
  isExpired,
  getClientIp,
  sanitizeUser,
  statusLabel
};
