process.env.TZ = 'America/Sao_Paulo';
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./src/config');
const { connectAndInit } = require('./src/database/db');
const userService = require('./src/services/userService');
const bcrypt = require('bcryptjs');

const authRoutes = require('./src/routes/auth');
const keysRoutes = require('./src/routes/keys');
const usersRoutes = require('./src/routes/users');
const logsRoutes = require('./src/routes/logs');
const validateRoutes = require('./src/routes/validate');
const creditsRoutes = require('./src/routes/credits');
const dashboardRoutes = require('./src/routes/dashboard');
const permissionsRoutes = require('./src/routes/permissions');
const platformsRoutes = require('./src/routes/platforms');
const walletRoutes = require('./src/routes/wallet');
const downloadsRoutes = require('./src/routes/downloads');
const publicFilesRoutes = require('./src/routes/publicFiles');
const geoRoutes = require('./src/routes/geo');

async function ensureOwner() {
  const targetUsername = String(process.env.OWNER_USERNAME || config.owner?.username || 'owner').trim();
  const targetPassword = String(process.env.OWNER_PASSWORD || config.owner?.password || 'owner123').trim();
  const hash = bcrypt.hashSync(targetPassword, 10);
  const db = require('./src/database/db');

  const existingOwner = await db.queryOne('SELECT * FROM users WHERE role = ?', [config.roles.OWNER]);

  if (!existingOwner) {
    // Remove qualquer usuário com mesmo username antes de inserir
    await db.run('DELETE FROM users WHERE LOWER(username) = LOWER(?)', [targetUsername]);
    // Usa upsert para evitar conflito de chave única
    if (db.isPg) {
      await db.run(`
        INSERT INTO users (username, password_hash, role, status, credits)
        VALUES (?, ?, ?, 'active', 999999)
        ON CONFLICT (username) DO UPDATE
          SET password_hash = EXCLUDED.password_hash,
              role = EXCLUDED.role,
              status = 'active',
              credits = 999999
      `, [targetUsername, hash, config.roles.OWNER]);
    } else {
      await db.run(`
        INSERT INTO users (username, password_hash, role, status, credits)
        VALUES (?, ?, ?, 'active', 999999)
      `, [targetUsername, hash, config.roles.OWNER]);
    }
    console.log(`[Project Dg] Owner criado a partir das variáveis de ambiente: ${targetUsername}`);
  } else {
    if (targetUsername.toLowerCase() !== existingOwner.username.toLowerCase()) {
      await db.run('DELETE FROM users WHERE LOWER(username) = LOWER(?) AND id != ?', [targetUsername, existingOwner.id]);
    }
    await db.run(`
      UPDATE users 
      SET username = ?, password_hash = ?, status = 'active', device_id = NULL
      WHERE id = ?
    `, [targetUsername, hash, existingOwner.id]);
    console.log(`[Project Dg] Owner sincronizado com variáveis de ambiente: ${targetUsername}`);
  }
}

const app = express();

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

connectAndInit().then(async () => {
  console.log('Banco de dados inicializado com sucesso.');
  await ensureOwner();

  app.use('/api/auth', authRoutes);
  app.use('/api/keys', keysRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/logs', logsRoutes);
  app.use('/api/validate', validateRoutes);
  app.use('/api/credits-page', creditsRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/permissions', permissionsRoutes);
  app.use('/api/platforms', platformsRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/downloads', downloadsRoutes);
  app.use('/api/public-files', publicFilesRoutes);
  app.use('/api/geo', geoRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'S7X Store' });
  });

  const rateLimit = require('express-rate-limit');
  const validationService = require('./src/services/validationService');
  const { getClientIp } = require('./src/utils/helpers');
  const config = require('./src/config');

  const apkLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).type('text/plain').send('Muitas tentativas. Aguarde.')
  });

  app.get('/CheckLogin.php', apkLimiter, async (req, res) => {
    try {
      const keyCode = (req.query.user || req.query.key || req.query.pass || '').trim();
      const deviceId = (req.query.uid || req.query.device_id || '').trim();
      const ipAddress = getClientIp(req);

      console.log(`[APK Login Attempt] Key: ${keyCode}, Device: ${deviceId}, IP: ${ipAddress}`);

      if (!keyCode || !deviceId) {
        return res.status(403).type('text/plain').send(config.validationMessages.INVALID);
      }

      const result = await validationService.validateKey({
        keyCode,
        deviceId,
        deviceInfo: req.query.device_info || null,
        ipAddress
      });

      if (result.success) {
        
        return res.status(200).type('text/plain').send(deviceId);
      } else {
        return res.status(403).type('text/plain').send(result.message || config.validationMessages.INVALID);
      }
    } catch (err) {
      console.error('[APK Validate Error]', err);
      return res.status(500).type('text/plain').send('Usuario invalido.');
    }
  });

  app.post('/api/apk/login', apkLimiter, async (req, res) => {
    try {
      const keyCode = (req.body.key || req.body.user || '').trim();
      const deviceId = (req.body.deviceId || req.body.hwid || req.body.uid || '').trim();
      const ipAddress = getClientIp(req);

      if (!keyCode || !deviceId) {
        return res.status(400).json({ status: 'failed', message: config.validationMessages.INVALID });
      }

      const result = await validationService.validateKey({
        keyCode,
        deviceId,
        deviceInfo: req.body.deviceInfo || 'ProxyAndroid APK',
        ipAddress
      });

      if (result.success) {
        return res.status(200).json({
          status: 'success',
          message: result.message || 'Login aprovado!',
          expira_em: result.expires_at || 'Nunca',
          validade: result.duration_days ? `${result.duration_days} dias` : 'Vitalício',
          devices_used: 1,
          max_devices: 1,
          vendedor: 'S7X STORE',
          versao_nome: 'S7X Proxy Android',
          versao_numero: '2.0'
        });
      } else {
        return res.status(403).json({
          status: 'failed',
          message: result.message || config.validationMessages.INVALID
        });
      }
    } catch (err) {
      console.error('[APK API Login Error]', err);
      return res.status(500).json({ status: 'failed', message: 'Erro interno no servidor' });
    }
  });

  app.post('/auth', apkLimiter, async (req, res) => {
    try {
      const keyCode = req.body.k;
      const deviceId = req.body.h;
      const ipAddress = getClientIp(req);

      if (!keyCode) {
        return res.status(200).type('text/plain').send('1');
      }

      const result = await validationService.validateKey({
        keyCode,
        deviceId: deviceId || 'unknown_device',
        deviceInfo: 'Android APK',
        ipAddress
      });

      if (result.success) {
        
        const crypto = require('crypto');
        const token = 'PM_' + crypto.createHash('sha256').update(keyCode).digest('hex').substring(0, 32);
        return res.status(200).type('text/plain').send(token);
      } else {
        
        if (result.message === config.validationMessages.OTHER_DEVICE) {
          return res.status(200).type('text/plain').send('2'); 
        }
        return res.status(200).type('text/plain').send('1'); 
      }
    } catch (err) {
      console.error('[APK Auth Request Error]', err);
      return res.status(200).type('text/plain').send('1');
    }
  });

  app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), {
    maxAge: '1y',
    immutable: true
  }));

  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: 0,
    etag: false
  }));

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  });

  app.listen(config.port, () => {
    console.log(`S7X Store rodando em http://localhost:${config.port}`);
  });
}).catch(err => {
  console.error('Falha ao inicializar o banco de dados:', err);
  process.exit(1);
});
