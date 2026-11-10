const express = require('express');
const https = require('https');
const querystring = require('querystring');
const userService = require('../services/userService');
const { signToken, authRequired } = require('../middleware/auth');
const { getClientIp } = require('../utils/helpers');
const logService = require('../services/logService');

const router = express.Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

function discordRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

router.get('/discord', async (req, res) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URI) {
    return res.status(503).json({ error: 'Discord OAuth não configurado no servidor.' });
  }

  const turnstileToken = req.query.ts;
  if (!turnstileToken) {
    return res.redirect('/?error=captcha_missing');
  }

  try {
    const turnstileData = new URLSearchParams();
    turnstileData.append('secret', '0x4AAAAAAF6178eJaWa8C0j3pyBOzcD4KF4');
    turnstileData.append('response', turnstileToken);
    turnstileData.append('remoteip', getClientIp(req));

    const tsRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: turnstileData
    });
    const tsResult = await tsRes.json();
    if (!tsResult.success) {
      return res.redirect('/?error=captcha_failed');
    }
  } catch (err) {
    return res.redirect('/?error=captcha_error');
  }

  const params = querystring.stringify({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify'
  });
  return res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

router.get('/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=discord_no_code');

  try {
    const tokenBody = querystring.stringify({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI
    });

    const tokenData = await discordRequest({
      hostname: 'discord.com',
      path: '/api/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(tokenBody)
      }
    }, tokenBody);

    if (!tokenData.access_token) {
      return res.redirect('/?error=discord_token_failed');
    }

    const discordUser = await discordRequest({
      hostname: 'discord.com',
      path: '/api/users/@me',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!discordUser.id) {
      return res.redirect('/?error=discord_user_failed');
    }

    const user = await userService.findOrCreateDiscordUser(discordUser);
    if (!user) return res.redirect('/?error=discord_create_failed');

    const token = signToken(user);

    await logService.createLog({
      userId: user.id,
      username: user.username,
      action: 'discord_login',
      ipAddress: getClientIp(req)
    });

    return res.redirect(`/?discord_token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('Discord OAuth error:', err);
    return res.redirect('/?error=discord_error');
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password, device_id, turnstileToken } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha obrigatórios' });
    }

    if (!turnstileToken) {
      return res.status(400).json({ error: 'Por favor, complete a verificação de segurança (CAPTCHA).' });
    }

    try {
      const turnstileData = new URLSearchParams();
      turnstileData.append('secret', '0x4AAAAAAF6178eJaWa8C0j3pyBOzcD4KF4');
      turnstileData.append('response', turnstileToken);
      turnstileData.append('remoteip', getClientIp(req));

      const tsRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: turnstileData
      });
      const tsResult = await tsRes.json();
      if (!tsResult.success) {
        return res.status(400).json({ error: 'Falha na verificação de segurança (CAPTCHA inválido).' });
      }
    } catch (err) {
      console.error('Erro no Turnstile:', err);
      return res.status(500).json({ error: 'Erro ao validar o CAPTCHA com o servidor.' });
    }

    const user = await userService.authenticate(username, password, device_id);
    if (!user) {
      await logService.createLog({
        username,
        action: 'login_failed',
        details: { username },
        ipAddress: getClientIp(req)
      });
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = signToken(user);

    await logService.createLog({
      userId: user.id,
      username: user.username,
      action: 'login_success',
      ipAddress: getClientIp(req)
    });

    return res.json({ token, user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/me', authRequired, async (req, res) => {
  const user = await userService.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const { password_hash, ...safe } = user;
  return res.json({ user: safe });
});

module.exports = router;
