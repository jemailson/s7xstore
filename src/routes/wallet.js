const express = require('express');
const router = express.Router();
const { authRequired, requireRoles } = require('../middleware/auth');
const config = require('../config');
const walletService = require('../services/walletService');
const db = require('../database/db');

router.get('/config', async (req, res) => {
  try {
    const configData = await walletService.getWalletConfig();
    res.json(configData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/config', authRequired, requireRoles(config.roles.OWNER, config.roles.ADMIN), async (req, res) => {
  try {
    const updated = await walletService.updateWalletConfig(req.body, req.user);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/pricing', async (req, res) => {
  try {
    const credits = parseInt(req.query.credits || '10', 10);
    const calculation = await walletService.calculateCreditPrice(credits);
    res.json(calculation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/pix', authRequired, async (req, res) => {
  try {
    const { credits } = req.body;
    const payment = await walletService.createPixPayment({
      user: req.user,
      credits
    });
    res.json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/status/:id', authRequired, async (req, res) => {
  try {
    const result = await walletService.checkPaymentStatus(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/transactions', authRequired, async (req, res) => {
  try {
    const transactions = await walletService.listTransactions(req.user.id, req.user.role);
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(['/webhook', '/webhook/mercadopago'], async (req, res) => {
  try {
    const { type, data, action } = req.body || {};
    const paymentId = data?.id || req.query['data.id'] || req.query.id || req.body?.id;

    if (paymentId && (type === 'payment' || action === 'payment.created' || action === 'payment.updated' || !type)) {
      const tx = await db.queryOne('SELECT * FROM transactions WHERE payment_id = ?', [String(paymentId)]);
      if (tx && tx.status !== 'approved') {
        const token = (process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || '').trim();
        if (token) {
          const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const mpJson = await response.json();
            if (mpJson.status === 'approved') {
              await walletService.approveTransaction(tx);
              console.log(`[MercadoPago Webhook] Transação ${tx.id} (Payment ${paymentId}) aprovada com sucesso!`);
            }
          }
        }
      }
    }
    res.status(200).send('OK');
  } catch (err) {
    console.error('[MercadoPago Webhook Error]', err);
    res.status(200).send('OK');
  }
});

module.exports = router;
