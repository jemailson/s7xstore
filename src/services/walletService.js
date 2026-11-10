const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const { nowLocal } = require('../utils/helpers');
const logService = require('./logService');

const DEFAULT_WALLET_CONFIG = {
  base_price: 3.0,
  min_credits: 1,
  minCredits: 1,
  bonus_credits: 7,
  bonus_min_credits: 10,
  tiers: [
    { min_credits: 10, max_credits: 19, discount_percent: 0, unit_price: 3.0, label: '10 a 19 créditos', badge: null },
    { min_credits: 20, max_credits: 49, discount_percent: 10, unit_price: 2.7, label: 'A partir de 20 créditos', badge: '10% OFF' },
    { min_credits: 50, max_credits: 74, discount_percent: 20, unit_price: 2.4, label: 'A partir de 50 créditos', badge: '20% OFF' },
    { min_credits: 75, max_credits: 99, discount_percent: 25, unit_price: 2.25, label: 'A partir de 75 créditos', badge: '25% OFF' },
    { min_credits: 100, max_credits: 199, discount_percent: 30, unit_price: 2.1, label: 'A partir de 100 créditos', badge: '30% OFF' },
    { min_credits: 200, max_credits: null, discount_percent: 40, unit_price: 1.8, label: 'A partir de 200 créditos', badge: '40% OFF' }
  ]
};

async function getWalletConfig() {
  try {
    const row = await db.queryOne("SELECT value FROM system_settings WHERE key = 'wallet_pricing'");
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      const rawMin = parsed.min_credits !== undefined ? parsed.min_credits : (parsed.minCredits !== undefined ? parsed.minCredits : 1);
      const minVal = Math.max(1, parseFloat(rawMin) || 1);
      return {
        base_price: Number(parsed.base_price || parsed.basePrice) || DEFAULT_WALLET_CONFIG.base_price,
        basePrice: Number(parsed.base_price || parsed.basePrice) || DEFAULT_WALLET_CONFIG.base_price,
        min_credits: minVal,
        minCredits: minVal,
        bonus_credits: parseInt(parsed.bonus_credits !== undefined ? parsed.bonus_credits : DEFAULT_WALLET_CONFIG.bonus_credits, 10),
        bonus_min_credits: parseInt(parsed.bonus_min_credits !== undefined ? parsed.bonus_min_credits : DEFAULT_WALLET_CONFIG.bonus_min_credits, 10),
        tiers: Array.isArray(parsed.tiers) && parsed.tiers.length > 0 ? parsed.tiers : DEFAULT_WALLET_CONFIG.tiers
      };
    }
  } catch (err) {
    console.error('Erro ao buscar configuração de carteira:', err.message);
  }
  return DEFAULT_WALLET_CONFIG;
}

async function updateWalletConfig(newConfig, actor) {
  if (!newConfig || typeof newConfig !== 'object') {
    throw new Error('Configuração inválida.');
  }

  const base_price = parseFloat(newConfig.base_price || newConfig.basePrice);
  if (isNaN(base_price) || base_price <= 0) {
    throw new Error('Preço base por crédito deve ser um número maior que zero.');
  }

  const rawMin = newConfig.min_credits !== undefined ? newConfig.min_credits : newConfig.minCredits;
  const min_credits = Math.max(1, parseFloat(rawMin) || 1);
  const bonus_credits = parseInt(newConfig.bonus_credits !== undefined ? newConfig.bonus_credits : 7, 10);
  const bonus_min_credits = parseInt(newConfig.bonus_min_credits !== undefined ? newConfig.bonus_min_credits : 10, 10);

  if (!Array.isArray(newConfig.tiers) || newConfig.tiers.length === 0) {
    throw new Error('A tabela deve conter pelo menos uma faixa de preço/desconto.');
  }

  const cleanedTiers = newConfig.tiers.map((tier) => {
    const min = parseFloat(tier.min_credits !== undefined ? tier.min_credits : tier.minCredits);
    const max = tier.max_credits !== null && tier.max_credits !== undefined && tier.max_credits !== ''
      ? parseFloat(tier.max_credits)
      : null;
    const discount = parseFloat(tier.discount_percent) || 0;
    let unit = parseFloat(tier.unit_price || tier.unitPrice);
    if (isNaN(unit) || unit <= 0) {
      unit = Number((base_price * (1 - discount / 100)).toFixed(2));
    }
    return {
      min_credits: isNaN(min) ? 0 : min,
      minCredits: isNaN(min) ? 0 : min,
      max_credits: max,
      discount_percent: discount,
      unit_price: Number(unit.toFixed(2)),
      label: tier.label || (max ? `${min} a ${max} créditos` : `A partir de ${min} créditos`),
      badge: tier.badge || (discount > 0 ? `${discount}% OFF` : null)
    };
  }).sort((a, b) => a.min_credits - b.min_credits);

  const finalConfig = {
    base_price,
    basePrice: base_price,
    min_credits,
    minCredits: min_credits,
    bonus_credits,
    bonus_min_credits,
    tiers: cleanedTiers
  };

  const jsonStr = JSON.stringify(finalConfig);
  const now = nowLocal();

  if (db.isPg) {
    await db.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('wallet_pricing', $1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [jsonStr, now]
    );
  } else {
    await db.run(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [jsonStr, now]
    );
  }

  if (actor && logService) {
    try {
      const logFn = logService.createLog || logService.log;
      if (typeof logFn === 'function') {
        await logFn({
          userId: actor.id,
          username: actor.username,
          action: 'UPDATE_WALLET_CONFIG',
          details: `Configuração da tabela de descontos atualizada: Preço Base R$ ${base_price.toFixed(2)}, Mínimo ${min_credits} crédito(s), ${cleanedTiers.length} faixas.`
        });
      }
    } catch (_) {}
  }

  return finalConfig;
}

async function calculateCreditPrice(credits, optionalConfig = null) {
  const cfg = optionalConfig || await getWalletConfig();
  const rawMin = cfg.min_credits !== undefined ? cfg.min_credits : (cfg.minCredits !== undefined ? cfg.minCredits : 1);
  const minAllowed = typeof rawMin === 'number' ? rawMin : (parseFloat(rawMin) || 1);
  const qty = parseFloat(String(credits || '0').replace(',', '.'));
  if (!qty || qty <= 0) {
    throw new Error('Informe uma quantidade de créditos válida maior que zero.');
  }
  if (qty < minAllowed) {
    throw new Error(`A quantidade mínima de compra é de ${minAllowed} crédito(s).`);
  }

  const basePrice = Number(cfg.base_price || cfg.basePrice) || 3.0;
  let unitPrice = basePrice;
  let discountPercent = 0;

  const sortedTiers = [...(cfg.tiers || [])].sort((a, b) => b.min_credits - a.min_credits);
  for (const tier of sortedTiers) {
    if (qty >= tier.min_credits) {
      unitPrice = Number(tier.unit_price);
      discountPercent = Number(tier.discount_percent);
      break;
    }
  }

  const bonusMin = cfg.bonus_min_credits !== undefined ? cfg.bonus_min_credits : 10;
  const bonusCredits = (cfg.bonus_credits > 0 && qty >= bonusMin) ? cfg.bonus_credits : 0;
  const totalCredits = Number((qty + bonusCredits).toFixed(2));
  const total = Number((qty * unitPrice).toFixed(2));
  const savings = Number((qty * basePrice - total).toFixed(2));

  return {
    quantity: qty,
    bonusCredits,
    totalCredits,
    unitPrice,
    discountPercent,
    total,
    savings: savings > 0 ? savings : 0,
    basePrice
  };
}

async function createPixPayment({ user, credits }) {
  const pricing = await calculateCreditPrice(credits);
  const token = (process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || '').trim();
  
  if (!token) {
    throw new Error('Mercado Pago Access Token não configurado no servidor. Configure a variável MERCADOPAGO_ACCESS_TOKEN no painel da Railway.');
  }

  const externalReference = `CRED_${user.id}_${Date.now()}_${uuidv4().substring(0, 8)}`;

  const bodyData = {
    transaction_amount: pricing.total,
    description: `Compra de ${pricing.quantity} créditos (+${pricing.bonusCredits} bônus) - ${user.username}`,
    payment_method_id: 'pix',
    payer: {
      email: `${user.username.toLowerCase().replace(/[^a-z0-9]/g, '') || 'usuario'}@s7xstore.com`,
      first_name: user.username
    },
    external_reference: externalReference
  };

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': uuidv4()
    },
    body: JSON.stringify(bodyData)
  });

  const resJson = await response.json();

  if (!response.ok) {
    const errorMsg = resJson.message || resJson.cause?.[0]?.description || 'Erro ao gerar pagamento no Mercado Pago.';
    throw new Error(errorMsg);
  }

  const paymentId = String(resJson.id);
  const qrCode = resJson.point_of_interaction?.transaction_data?.qr_code || '';
  const qrCodeBase64 = resJson.point_of_interaction?.transaction_data?.qr_code_base64 || '';
  const ticketUrl = resJson.point_of_interaction?.transaction_data?.ticket_url || '';

  const insertRes = await db.run(`
    INSERT INTO transactions (user_id, amount, credits, status, payment_id, external_reference, qr_code, qr_code_base64, ticket_url, created_at, updated_at)
    VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
  `, [
    user.id,
    pricing.total,
    pricing.totalCredits,
    paymentId,
    externalReference,
    qrCode,
    qrCodeBase64,
    ticketUrl,
    nowLocal(),
    nowLocal()
  ]);

  return {
    id: insertRes.lastInsertRowid,
    paymentId,
    amount: pricing.total,
    credits: pricing.totalCredits,
    baseCredits: pricing.quantity,
    bonusCredits: pricing.bonusCredits,
    status: 'pending',
    qrCode,
    qrCodeBase64,
    ticketUrl
  };
}

async function checkPaymentStatus(transactionId, user) {
  const tx = await db.queryOne('SELECT * FROM transactions WHERE id = ?', [transactionId]);
  if (!tx) {
    throw new Error('Transação não encontrada.');
  }

  if (user && user.role !== 'owner' && user.role !== 'admin' && tx.user_id !== user.id) {
    throw new Error('Acesso negado.');
  }

  if (tx.status === 'approved') {
    return { status: 'approved', credits: tx.credits, amount: tx.amount };
  }

  const token = (process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || '').trim();
  if (!token || !tx.payment_id) {
    return { status: tx.status, credits: tx.credits, amount: tx.amount };
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${tx.payment_id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return { status: tx.status, credits: tx.credits, amount: tx.amount };
    }

    const resJson = await response.json();
    const mpStatus = resJson.status;

    if (mpStatus === 'approved' && tx.status !== 'approved') {
      await approveTransaction(tx);
      return { status: 'approved', credits: tx.credits, amount: tx.amount };
    } else if (mpStatus === 'cancelled' || mpStatus === 'rejected') {
      await db.run('UPDATE transactions SET status = ?, updated_at = ? WHERE id = ?', [
        mpStatus === 'cancelled' ? 'cancelled' : 'rejected',
        nowLocal(),
        tx.id
      ]);
      return { status: mpStatus, credits: tx.credits, amount: tx.amount };
    }

    return { status: mpStatus || tx.status, credits: tx.credits, amount: tx.amount };
  } catch (err) {
    console.error('[MercadoPago checkPaymentStatus error]', err.message);
    return { status: tx.status, credits: tx.credits, amount: tx.amount };
  }
}

async function approveTransaction(tx) {
  const config = require('../config');
  await db.transaction(async (trx) => {
    const freshTx = await trx.queryOne('SELECT * FROM transactions WHERE id = ?', [tx.id]);
    if (freshTx.status === 'approved') return;

    await trx.run('UPDATE transactions SET status = ?, updated_at = ? WHERE id = ?', [
      'approved',
      nowLocal(),
      tx.id
    ]);

    const targetUser = await trx.queryOne('SELECT id, credits, username, role, reseller_type FROM users WHERE id = ?', [tx.user_id]);
    if (targetUser) {
      const currentCredits = parseFloat(targetUser.credits) || 0;
      const addCredits = parseFloat(tx.credits) || 0;
      const newCredits = Number((currentCredits + addCredits).toFixed(2));

      let newRole = targetUser.role;
      let newResellerType = targetUser.reseller_type;

      if (targetUser.role === config.roles.MEMBER && newCredits > 0) {
        newRole = config.roles.RESELLER;
        newResellerType = config.resellerTypes.CLASSIC;
        await trx.run(`
          INSERT INTO logs (user_id, username, action, details, created_at)
          VALUES (?, ?, ?, ?, ?)
        `, [
          tx.user_id,
          targetUser.username,
          'user_promoted_to_reseller',
          JSON.stringify({
            reason: 'pix_purchase_promotion',
            previous_role: config.roles.MEMBER,
            new_role: config.roles.RESELLER
          }),
          nowLocal()
        ]);
      }

      await trx.run('UPDATE users SET credits = ?, role = ?, reseller_type = ?, updated_at = ? WHERE id = ?', [
        newCredits,
        newRole,
        newResellerType,
        nowLocal(),
        tx.user_id
      ]);

      await trx.run(`
        INSERT INTO logs (user_id, username, action, details, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [
        tx.user_id,
        targetUser.username,
        'credits_purchased_pix',
        JSON.stringify({
          transaction_id: tx.id,
          payment_id: tx.payment_id,
          amount: tx.amount,
          credits: tx.credits,
          new_total: newCredits,
          promoted_to_reseller: newRole === config.roles.RESELLER && targetUser.role === config.roles.MEMBER
        }),
        nowLocal()
      ]);
    }
  });
}

async function listTransactions(userId, role, limit = 20) {
  if (role === 'owner' || role === 'admin') {
    return db.query(`
      SELECT t.*, u.username 
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      ORDER BY t.id DESC
      LIMIT ?
    `, [limit]);
  }
  return db.query(`
    SELECT * FROM transactions 
    WHERE user_id = ? 
    ORDER BY id DESC 
    LIMIT ?
  `, [userId, limit]);
}

module.exports = {
  DEFAULT_WALLET_CONFIG,
  getWalletConfig,
  updateWalletConfig,
  calculateCreditPrice,
  createPixPayment,
  checkPaymentStatus,
  approveTransaction,
  listTransactions
};
