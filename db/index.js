const Database = require('better-sqlite3');
const path = require('path');
const { runSchema } = require('./schema');
const { runMigrations } = require('./migrations');

const dbPath = path.join(__dirname, 'autonix.db');
let db = null;

function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const database = getDb();
  runSchema(database);
  runMigrations(database);
  return database;
}

module.exports = {
  getDb,
  initDb,
  runSchema,
};
