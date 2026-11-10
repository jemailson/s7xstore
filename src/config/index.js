require('dotenv').config();
const path = require('path');
const fs = require('fs');

let botConfigToken = null;
try {
  const botConfigPath = path.join(__dirname, '../../../Project Bot/config.json');
  if (fs.existsSync(botConfigPath)) {
    const botCfg = JSON.parse(fs.readFileSync(botConfigPath, 'utf8'));
    if (botCfg.token) botConfigToken = botCfg.token;
  }
} catch (_) {}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  discordBotToken: process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || botConfigToken || null,
  jwt: {
    secret: process.env.JWT_SECRET || 's7x-default-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/s7x.db'),
  owner: {
    username: process.env.OWNER_USERNAME || 'owner',
    password: process.env.OWNER_PASSWORD || 'owner123'
  },
  roles: {
    OWNER: 'owner',
    ADMIN: 'admin',
    RESELLER: 'reseller',
    MEMBER: 'member',
    DOWNLOAD_ADMIN: 'download_admin'
  },
  resellerTypes: {
    CLASSIC: 'classic',
    RUBI: 'rubi'
  },
  keyStatus: {
    AWAITING: 'awaiting_activation',
    ACTIVE: 'active',
    PAUSED: 'paused',
    EXPIRED: 'expired',
    DEACTIVATED: 'deactivated'
  },
  validationMessages: {
    SUCCESS: 'Login Sucedido!',
    INVALID: 'Usuário inválido',
    OTHER_DEVICE: 'Logada em outro dispositivo',
    EXPIRED: 'Key expirada',
    BLOCKED: 'Key pausada/desativada'
  },
  creditsInfo: {
    discord: 'https://discord.gg/7ndtJqfFKV',
    owner: 'S7X STORE',
    manager: 'Gerente Oficial S7X',
    developer: 'Créditos ao desenvolvedor do Gerador S7X Oficial'
  }
};
