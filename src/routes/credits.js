const express = require('express');
const config = require('../config');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  return res.json({
    credits: config.creditsInfo
  });
});

module.exports = router;
