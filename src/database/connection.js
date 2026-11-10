const db = require('./db');

function getDb() {
  return db;
}

module.exports = { getDb, closeDb: db.closeDb };
