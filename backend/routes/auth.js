const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'calibpro-jwt-secret-2025';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
});

// GET /api/auth/me — verify token and return user
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/users — list all users (admin only)
router.get('/users', requireAdmin, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, role, name, active, created_at FROM users ORDER BY id').all();
  res.json(users);
});

// POST /api/auth/users — create user (admin only)
router.post('/users', requireAdmin, (req, res) => {
  const { username, password, role, name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Role must be admin or user' });

  const db = getDb();
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)').run(username.trim(), hash, role, name || username);
    res.json({ id: result.lastInsertRowid, username, role, name: name || username });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/auth/users/:id — update user (admin only)
router.put('/users/:id', requireAdmin, (req, res) => {
  const { username, password, role, name, active } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Prevent removing the last admin
  if (role === 'user' && user.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='admin' AND active=1").get().c;
    if (adminCount <= 1) return res.status(400).json({ error: 'Cannot demote the only admin' });
  }

  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;
  db.prepare('UPDATE users SET username=?, password_hash=?, role=?, name=?, active=? WHERE id=?')
    .run(username || user.username, newHash, role || user.role, name || user.name, active !== undefined ? (active ? 1 : 0) : user.active, req.params.id);
  res.json({ success: true });
});

// DELETE /api/auth/users/:id — delete user (admin only)
router.delete('/users/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='admin' AND active=1").get().c;
    if (adminCount <= 1) return res.status(400).json({ error: 'Cannot delete the only admin' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
