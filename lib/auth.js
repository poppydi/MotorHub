const bcrypt = require('bcryptjs');
const { getDb } = require('../db');

const SALT_ROUNDS = 10;

function hashPassword(plain) {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}

function comparePassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.userId) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Требуется авторизация' });
      }
      return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
    }
    const db = getDb();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    if (!user || !roles.includes(user.role)) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ error: 'Недостаточно прав' });
      }
      return res.status(403).send('Недостаточно прав');
    }
    req.userRole = user.role;
    next();
  };
}

function requireStaff(req, res, next) {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
  if (user && user.role === 'customer') {
    return res.redirect('/');
  }
  next();
}

module.exports = { hashPassword, comparePassword, requireAuth, requireRole, requireStaff };
