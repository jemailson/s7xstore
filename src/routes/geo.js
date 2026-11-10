const express = require('express');
const router = express.Router();
const { getClientIp } = require('../utils/helpers');

const SPANISH_COUNTRIES = [
  'ES', 'AR', 'MX', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT',
  'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'PR'
];

router.get('/detect-language', async (req, res) => {
  try {
    let ip = getClientIp(req);
    if (ip && ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }

    if (
      !ip ||
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.16.') ||
      ip.startsWith('172.17.') ||
      ip.startsWith('172.18.') ||
      ip.startsWith('172.19.') ||
      ip.startsWith('172.2') ||
      ip.startsWith('172.3')
    ) {
      return res.json({ language: 'pt', country: 'BR', ip, detected: false, isLocal: true });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode,country`, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (geoRes.ok) {
      const data = await geoRes.json();
      if (data.status === 'success') {
        const country = (data.countryCode || '').toUpperCase();
        if (country === 'BR' || country === 'PT') {
          return res.json({ language: 'pt', country, ip, detected: true });
        }
        if (SPANISH_COUNTRIES.includes(country)) {
          return res.json({ language: 'es', country, ip, detected: true });
        }
        return res.json({ language: 'en', country, ip, detected: true });
      }
    }

    return res.json({ language: 'pt', country: 'BR', ip, detected: false });
  } catch (err) {
    return res.json({ language: 'pt', country: 'BR', detected: false, error: err.message });
  }
});

module.exports = router;
